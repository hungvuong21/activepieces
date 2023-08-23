import fs from 'fs-extra'
import {
    Action,
    ActionType,
    ActivepiecesError,
    apId,
    ErrorCode,
    ExecuteFlowOperation,
    ExecutionOutput,
    ExecutionOutputStatus,
    ExecutionType,
    FileId,
    flowHelper,
    FlowRunId,
    FlowVersion,
    FlowVersionState,
    ProjectId,
    StepOutputStatus,
    Trigger,
    TriggerType,
} from '@activepieces/shared'
import { Sandbox, sandboxManager } from '../sandbox'
import { flowVersionService } from '../../flows/flow-version/flow-version.service'
import { fileService } from '../../file/file.service'
import { flowRunService } from '../../flows/flow-run/flow-run-service'
import { OneTimeJobData } from './job-data'
import { engineHelper } from '../../helper/engine-helper'
import { captureException, logger } from '../../helper/logger'
import { pieceManager } from '../../flows/common/piece-installer'
import { isNil } from '@activepieces/shared'
import { getServerUrl } from '../../helper/public-ip-utils'
import { acquireLock } from '../../helper/lock'
import {
    PackageInfo,
} from '../../helper/package-manager'
import { codeBuilder } from '../code-worker/code-builder'
import { logsService } from '../../flows/flow-run/logs/run-logs.service'

type InstallPiecesParams = {
    path: string
    projectId: ProjectId
    flowVersion: FlowVersion
}

type FinishExecutionParams = {
    flowRunId: FlowRunId
    logFileId: FileId
    executionOutput: ExecutionOutput
}

type LoadInputAndLogFileIdParams = {
    flowVersion: FlowVersion
    jobData: OneTimeJobData
}

type LoadInputAndLogFileIdResponse = {
    input: ExecuteFlowOperation
    logFileId?: FileId | undefined
}

const extractFlowPieces = async ({
    flowVersion,
}: {
    projectId: ProjectId
    flowVersion: FlowVersion
}) => {
    const pieces: PackageInfo[] = []
    const steps = flowHelper.getAllSteps(flowVersion.trigger)

    for (const step of steps) {
        if (step.type === TriggerType.PIECE || step.type === ActionType.PIECE) {
            const { pieceName, pieceVersion } = step.settings
            pieces.push({
                name: pieceName,
                version: pieceVersion,
            })
        }
    }

    return pieces
}

const installPieces = async (params: InstallPiecesParams): Promise<void> => {
    const { path, flowVersion, projectId } = params
    const pieces = await extractFlowPieces({ projectId, flowVersion })

    await pieceManager.install({
        projectPath: path,
        pieces,
    })
}

const finishExecution = async (
    params: FinishExecutionParams,
): Promise<void> => {
    logger.trace(params, '[FlowWorker#finishExecution] params')

    const { flowRunId, logFileId, executionOutput } = params

    if (executionOutput.status === ExecutionOutputStatus.PAUSED) {
        await flowRunService.pause({
            flowRunId,
            logFileId,
            pauseMetadata: executionOutput.pauseMetadata,
        })
    }
    else {
        await flowRunService.finish({
            flowRunId,
            status: executionOutput.status,
            tasks: executionOutput.tasks,
            logsFileId: logFileId,
            tags: executionOutput.tags ?? [],
        })
    }
}

const loadInputAndLogFileId = async ({
    flowVersion,
    jobData,
}: LoadInputAndLogFileIdParams): Promise<LoadInputAndLogFileIdResponse> => {
    const baseInput = {
        flowVersion,
        flowRunId: jobData.runId,
        projectId: jobData.projectId,
        triggerPayload: {
            duration: 0,
            input: {},
            output: jobData.payload,
            status: StepOutputStatus.SUCCEEDED,
        },
    }

    if (jobData.executionType === ExecutionType.BEGIN) {
        return {
            input: {
                serverUrl: await getServerUrl(),
                executionType: ExecutionType.BEGIN,
                ...baseInput,
            },
        }
    }

    const flowRun = await flowRunService.getOneOrThrow({
        id: jobData.runId,
        projectId: jobData.projectId,
    })

    if (isNil(flowRun.pauseMetadata) || isNil(flowRun.logsFileId)) {
        throw new ActivepiecesError({
            code: ErrorCode.VALIDATION,
            params: {
                message: `flowRunId=${flowRun.id}`,
            },
        })
    }

    const logFile = await fileService.getOneOrThrow({
        fileId: flowRun.logsFileId,
        projectId: jobData.projectId,
    })

    const serializedExecutionOutput = logFile.data.toString('utf-8')
    const executionOutput = JSON.parse(
        serializedExecutionOutput,
    ) as ExecutionOutput

    return {
        input: {
            serverUrl: await getServerUrl(),
            executionType: ExecutionType.RESUME,
            executionState: executionOutput.executionState,
            resumeStepMetadata: flowRun.pauseMetadata.resumeStepMetadata,
            resumePayload: jobData.payload,
            ...baseInput,
        },
        logFileId: logFile.id,
    }
}

async function executeFlow(jobData: OneTimeJobData): Promise<void> {
    logger.info(
        `[FlowWorker#executeFlow] flowRunId=${jobData.runId} executionType=${jobData.executionType}`,
    )

    const flowVersion = await flowVersionService.lockPieceVersions(
        jobData.projectId,
        await flowVersionService.getOneOrThrow(jobData.flowVersionId),
    )

    // Don't use sandbox for draft versions, since they are mutable and we don't want to cache them.
    const key =
    flowVersion.id +
    (FlowVersionState.DRAFT === flowVersion.state ? '-draft' + apId() : '')
    const sandbox = await sandboxManager.obtainSandbox(key)
    const startTime = Date.now()
    logger.info(
        `[${jobData.runId}] Executing flow ${flowVersion.id} in sandbox ${sandbox.boxId}`,
    )
    try {
        if (!sandbox.cached) {
            await sandbox.recreate()
            await downloadFiles(sandbox, jobData.projectId, flowVersion)

            const path = sandbox.getSandboxFolderPath()

            await installPieces({
                projectId: jobData.projectId,
                path,
                flowVersion,
            })

            logger.info(
                `[${jobData.runId}] Preparing sandbox ${sandbox.boxId} took ${
                    Date.now() - startTime
                }ms`,
            )
        }
        else {
            await sandbox.clean()
            logger.info(
                `[${jobData.runId}] Reusing sandbox ${sandbox.boxId} took ${
                    Date.now() - startTime
                }ms`,
            )
        }

        const { input } = await loadInputAndLogFileId({
            flowVersion,
            jobData,
        })

        const { result: executionOutput } = await engineHelper.executeFlow(
            sandbox,
            input,
        )

        const logStartTime = Date.now()
        const logsFile = await logsService.save({
            flowRunId: jobData.runId,
            projectId: jobData.projectId,
            data: executionOutput,
        })
        logger.info('Saving logs took' +  (Date.now() - logStartTime) + 'ms');

        await finishExecution({
            flowRunId: jobData.runId,
            logFileId: logsFile,
            executionOutput,
        })

        logger.info(
            `[FlowWorker#executeFlow] flowRunId=${
                jobData.runId
            } executionOutputStats=${executionOutput.status} sandboxId=${
                sandbox.boxId
            } duration=${Date.now() - startTime} ms`,
        )
    }
    catch (e: unknown) {
        if (e instanceof ActivepiecesError && e.error.code === ErrorCode.EXECUTION_TIMEOUT) {
            await flowRunService.finish({
                flowRunId: jobData.runId,
                status: ExecutionOutputStatus.TIMEOUT,
                tasks: 1,
                logsFileId: null,
                tags: [],
            })
        }
        else {
            logger.error(e, `[${jobData.runId}] Error executing flow`)
            captureException(e as Error)
            await flowRunService.finish({
                flowRunId: jobData.runId,
                status: ExecutionOutputStatus.INTERNAL_ERROR,
                tasks: 0,
                logsFileId: null,
                tags: [],
            })
        }
    }
    finally {
        await sandboxManager.returnSandbox(sandbox.boxId)
    }
}

async function downloadFiles(
    sandbox: Sandbox,
    projectId: ProjectId,
    flowVersion: FlowVersion,
): Promise<void> {
    logger.info(`[${flowVersion.id}] Acquiring flow lock to build codes`)
    const flowLock = await acquireLock({
        key: flowVersion.id,
        timeout: 180000,
    })
    try {
        const buildPath = sandbox.getSandboxFolderPath()
        await ensureBuildDirectory(buildPath)
        const codeSteps = getCodeSteps(flowVersion.trigger)

        await Promise.all(
            codeSteps.map((step) =>
                codeBuilder.processCodeStep(step, buildPath, flowVersion.id, projectId),
            ),
        )
    }
    finally {
        logger.info(`[${flowVersion.id}] Releasing flow lock`)
        await flowLock.release()
    }
}

async function ensureBuildDirectory(buildPath: string): Promise<void> {
    await fs.ensureDir(`${buildPath}/codes/`)
}

function getCodeSteps(trigger: Trigger): (Action | Trigger)[] {
    const steps = flowHelper.getAllSteps(trigger)
    return steps.filter((step) => step.type === ActionType.CODE)
}

export const flowWorker = {
    executeFlow,
}
