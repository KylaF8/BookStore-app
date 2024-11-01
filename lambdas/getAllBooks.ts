import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION })
);

export const handler: Handler = async (event, context) => {
  try {
    console.log("Fetching all books...");

    const command = new ScanCommand({
      TableName: process.env.TABLE_NAME,
    });
    const commandOutput = await ddbDocClient.send(command);

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ data: commandOutput.Items }),
    };
  } catch (error) {
    console.log("Error fetching books:", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to fetch books" }),
    };
  }
};