import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import * as AWS from "aws-sdk";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

const translate = new AWS.Translate();
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const language = event.queryStringParameters?.language;
    const parameters = event?.pathParameters;
    const bookId = parameters?.bookId ? parseInt(parameters.bookId) : undefined;

  if (!bookId || !language) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing bookId or language parameter" }),
    };
  }

  const translationKey = {
    bookId: bookId,
    language: language,
  };

  try {
    const translation = await ddbDocClient.send(new GetCommand({
        TableName: process.env.TRANSLATE_TABLE_NAME,
        Key: { bookId, language },
      }));
    
    if (translation.Item) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Translation found", translation: translation.Item }),
      };
    }

    const original = await ddbDocClient.send(new GetCommand({
        TableName: process.env.BOOKS_TABLE_NAME,
        Key: { id : bookId },
      }));
    
    if (!original.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Original item not found" }),
      };
    }

    const translateParams = {
        SourceLanguageCode: "en",
        TargetLanguageCode: language,
        Text: original.Item.synopsis,
      };
  
      const translatedMessage = await translate.translateText(translateParams).promise();
      const translatedText = translatedMessage.TranslatedText;
  
      await ddbDocClient.send(new PutCommand({
        TableName: process.env.TRANSLATE_TABLE_NAME,
        Item: {
          bookId,
          language: language,
          translatedSynopsis: translatedText,
          title: original.Item.title,
          original_title: original.Item.original_title,
          genre: original.Item.genre,
          synopsis: original.Item.synopsis,
          original_language: original.Item.original_language,
          release_date: original.Item.release_date,
        },
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({
            bookId,
            translatedSynopsis: translatedText,
            title: original.Item.title,
            original_title: original.Item.original_title,
            genre: original.Item.genre,
            synopsis: original.Item.synopsis,
            original_language: original.Item.original_language,
            release_date: original.Item.release_date,
        }),
      };
    } catch (error) {
      console.error(error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  };