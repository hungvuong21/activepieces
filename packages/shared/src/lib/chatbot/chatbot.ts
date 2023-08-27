import { Static, Type } from '@sinclair/typebox';
import { BaseModelSchema } from '../common';

export const DataSource = Type.Object({
  displayName: Type.String(),
  id: Type.String(),
  pieceName: Type.String(),
  sourceName: Type.String(),
  auth: Type.Optional(Type.String()),
  props: Type.Record(Type.String(), Type.Unknown())
});

export type DataSource = Static<typeof DataSource>;

export const Chatbot = Type.Object({
  ...BaseModelSchema,
  type: Type.String(),
  displayName: Type.String(),
  projectId: Type.String(),
  settings: Type.Object({
    auth: Type.String(),
    prompt: Type.String()
  }),
  dataSources: Type.Array(DataSource)
});

export type Chatbot = Static<typeof Chatbot>;

export const CreateChatBotRequest = Type.Object({
  type: Type.String()
});

export type CreateChatBotRequest = Static<typeof CreateChatBotRequest>;
export const UpdateChatbotRequest = Type.Object({
  displayName: Type.String(),
  settings: Type.Object({
    prompt: Type.String(),
    auth: Type.String()
  })
});

export type UpdateChatbotRequest = Static<typeof UpdateChatbotRequest>;

export const ListChatbotsRequest = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number())
});

export type ListChatbotsRequest = Static<typeof ListChatbotsRequest>;

export const ChatbotResponse = Type.Object({
  output: Type.String()
});

export type ChatbotResponse = Static<typeof ChatbotResponse>;

export const CreateDataSourceRequest = Type.Object({
  displayName: Type.String(),
  pieceName: Type.String(),
  sourceName: Type.String(),
  auth: Type.Optional(Type.String()),
  props: Type.Record(Type.String(), Type.Unknown())
});

export type CreateDataSourceRequest = Static<typeof CreateDataSourceRequest>;

export const DeleteDataSourceRequest = Type.Object({
  name: Type.String()
});

export type DeleteDataSourceRequest = Static<typeof DeleteDataSourceRequest>;

export const TelegramWebhookRequest = Type.Object({
  update_id: Type.Number(),
  message: Type.Object({
    message_id: Type.Number(),
    from: Type.Object({
      id: Type.Number(),
      is_bot: Type.Boolean(),
      first_name: Type.String(),
      last_name: Type.String(),
      username: Type.String(),
      language_code: Type.String()
    }),
    chat: Type.Object({
      id: Type.Number(),
      first_name: Type.String(),
      last_name: Type.String(),
      username: Type.String(),
      type: Type.String()
    }),
    date: Type.Number(),
    text: Type.String()
  })
});

export type TelegramWebhookRequest = Static<typeof TelegramWebhookRequest>;