const enum ClickupEventType {
  TASK_CREATED = "taskCreated",
  TASK_UPDATED = "taskUpdated",
  TASK_DELETED = "taskDeleted",
  TASK_PRIORITYUPDATED = "taskPriorityUpdated",
  TASK_STATUSUPDATED = "taskStatusUpdated",
  TASK_ASSIGNEEUPDATED = "taskAssigneeUpdated",
  TASK_DUEDATEUPDATED = "taskDueDateUpdated",
  TASK_TAGUPDATED = "taskTagUpdated",
  TASK_MOVED = "taskMoved",
  TASK_COMMENT_POSTED = "taskCommentPosted",
  TASK_COMMENT_UPDATED = "taskCommentUpdated",
  TASK_TIME_ESTIMATE_UPDATED = "taskTimeEstimateUpdated",
  TASK_TIME_TRACKED_UPDATED = "taskTimeTrackedUpdated",
  LIST_CREATED = "listCreated",
  LIST_UPDATED = "listUpdated",
  LIST_DELETED = "listDeleted",
  FOLDER_CREATED = "folderCreated",
  FOLDER_UPDATED = "folderUpdated",
  FOLDER_DELETED = "folderDeleted",
  SPACE_CREATED = "spaceCreated",
  SPACE_UPDATED = "spaceUpdated",
  SPACE_DELETED = "spaceDeleted",
  GOAL_CREATED = "goalCreated",
  GOAL_UPDATED = "goalUpdated",
  GOAL_DELETED = "goalDeleted",
  KEY_RESULT_CREATED = "keyResultCreated",
  KEY_RESULT_UPDATED = "keyResultUpdated",
  KEY_RESULT_DELETED = "keyResultDeleted",
}

const clickupTriggers = [
  {
    name: "task_created",
    eventType: ClickupEventType.TASK_CREATED,
    displayName: 'Task Created',
    description: 'Triggered when a new task is created.'
  },
  {
    name: "task_updated",
    eventType: ClickupEventType.TASK_UPDATED,
    displayName: 'Task Updated',
    description: 'Triggered when a task is updated.'
  }
]