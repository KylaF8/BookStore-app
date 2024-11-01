import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
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
    let commandInput: QueryCommandInput = {
      TableName: process.env.CAST_TABLE_NAME, 
    };

    if ("roleName" in queryParams) {
      commandInput = {
        ...commandInput,
        IndexName: "roleIx", 
        KeyConditionExpression: "bookId = :b and begins_with(roleName, :r)",
        ExpressionAttributeValues: {
          ":b": bookId,
          ":r": queryParams.roleName,
        },
      };
    } else if ("characterName" in queryParams) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "bookId = :b and begins_with(characterName, :c)",
        ExpressionAttributeValues: {
          ":b": bookId,
          ":c": queryParams.characterName,
        },
      };
    } else {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "bookId = :b",
        ExpressionAttributeValues: {
          ":b": bookId,
        },
      };
    }

    const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: commandOutput.Items,
      }),
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
