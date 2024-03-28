import {
	ClientConfig,
	MessageAPIResponseBase,
	MiddlewareConfig,
	TextMessage,
	middleware,
	messagingApi,
	webhook,
} from '@line/bot-sdk';
import wiki from 'wikijs';
import express, { Application } from 'express';
import { load } from 'ts-dotenv';

const env = load({
	PORT: Number,
	CHANNEL_ACCESS_TOKEN: String,
	CHANNEL_SECRET: String,
});

const clientConfig: ClientConfig = {
	channelAccessToken: env.CHANNEL_ACCESS_TOKEN || '',
};
const middlewareConfig: MiddlewareConfig = {
	channelAccessToken: env.CHANNEL_ACCESS_TOKEN || '',
	channelSecret: env.CHANNEL_SECRET || '',
};

const client = new messagingApi.MessagingApiClient(clientConfig);

const app: Application = express();

const isTextEvent = (
	event: any
): event is webhook.MessageEvent & { message: webhook.TextMessageContent } => {
	return (
		event.type === 'message' && event.message && event.message.type === 'text'
	);
};

// 入力テキストをおうむ返しする
// const textEventHandler = async (
// 	event: webhook.Event
// ): Promise<MessageAPIResponseBase | undefined> => {
// 	if (!isTextEvent(event)) return Promise.resolve(undefined);

// 	const messages: TextMessage[] = [
// 		{
// 			type: 'text',
// 			text: event.message.text,
// 		},
// 	];
// 	await client.replyMessage({
// 		replyToken: event.replyToken as string,
// 		messages,
// 	});
// };

const apiUrl = 'https://ja.wikipedia.org/w/api.php';

const fetchWikiPage = async (keyword: string) => {
	const page = await wiki({ apiUrl }).page(keyword);
	return await page.summary();
};

const replyWithMessage = async (event: any, messages: TextMessage[]) => {
	await client.replyMessage({
		replyToken: event.replyToken,
		messages,
	});
};

app.post('/webhook', middleware(middlewareConfig), async (req, res) => {
	const events: webhook.Event[] = req.body.events;

	await Promise.all(
		events.map(async (event) => {
			if (!isTextEvent(event)) return Promise.resolve(undefined);
			const keyword: string = event.message.text;

			try {
				const pageInfo = await fetchWikiPage(keyword);
				const messages: TextMessage[] = [
					{
						type: 'text',
						text: pageInfo,
					},
				];
				await replyWithMessage(event, messages);
			} catch (error: unknown) {
				if (error instanceof Error) {
					console.error(error);
				}
				await replyWithMessage(event, [
					{
						type: 'text',
						text: '該当するページが見つかりませんでした。',
					},
				]);
			}
		})
	);
	return res.status(200);
});

// 接続テスト用
app.get('/', async (_, res) => {
	return res.status(200).send({ message: 'Hello World!' });
});

const PORT = env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

// reference: https://github.com/line/line-bot-sdk-nodejs/blob/master/examples/echo-bot-ts/index.ts
