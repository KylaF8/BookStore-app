import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { CookieMap, createPolicy, JwtToken, parseCookies, verifyToken } from "../shared/util";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async function (event: any) {
  try {
    console.log("[EVENT]", JSON.stringify(event));
    const cookies: CookieMap = parseCookies(event);
    if (!cookies) {
      return {
        statusCode: 200,
        body: "Unauthorised request!!",
      };
    }
    const verifiedJwt: JwtToken | null = await verifyToken(
      cookies.token,
      process.env.USER_POOL_ID!,
      process.env.REGION!
    );

    const parameters = event?.pathParameters;
    const bookId = parameters?.bookId ? parseInt(parameters.bookId) : undefined;

    if (!bookId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Invalid or missing book ID" }),
      };
    }

    const commandOutput = await ddbDocClient.send(
      new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: bookId },
      })
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Book deleted successfully" }),
    };
  } catch (error: any) {
    console.error("[ERROR]", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: "An error occurred while deleting the book" }),
    };
  }
};

function createDDbDocClient() {
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