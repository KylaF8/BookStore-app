import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));
    const queryParams = event.queryStringParameters;

    if (!queryParams) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }

    if (!queryParams.bookId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing book Id parameter" }),
      };
    }

    const bookId = parseInt(queryParams.bookId);
    const includeFacts = queryParams.facts === "true";

    let commandInput: QueryCommandInput = {
      TableName: process.env.CAST_TABLE_NAME,
      KeyConditionExpression: "bookId = :b",
      ExpressionAttributeValues: {
        ":b": bookId,
      },
    };

    if ("roleName" in queryParams) {
      commandInput.IndexName = "roleIx";
      commandInput.KeyConditionExpression = "bookId = :b and begins_with(roleName, :r)";
      commandInput.ExpressionAttributeValues![":r"] = queryParams.roleName;
    } else if ("characterName" in queryParams) {
      commandInput.KeyConditionExpression = "bookId = :b and begins_with(characterName, :c)";
      commandInput.ExpressionAttributeValues![":c"] = queryParams.characterName;
    }

    const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));
    const responseBody: any = { cast: commandOutput.Items };

    if (includeFacts) {
      const bookDetails = await ddbDocClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME, 
          Key: { id: bookId },
        })
      );

      if (bookDetails.Item) {
        responseBody.bookDetails = {
          title: bookDetails.Item.title,
          genre: bookDetails.Item.genre,
          synopsis: bookDetails.Item.synopsis,
        };
      } else {
        responseBody.bookDetails = { message: "No additional book details found" };
      }
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.log("Error: ", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to fetch book characters" }),
    };
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}