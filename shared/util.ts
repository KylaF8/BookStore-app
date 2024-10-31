import { marshall } from "@aws-sdk/util-dynamodb";
import { Book } from "./types";

export const generateBookItem = (book: Book) => {
  return {
    PutRequest: {
      Item: marshall(book),
    },
  };
};

export const generateBatch = (data: Book[]) => {
  return data.map((e) => {
    return generateBookItem(e);
  });
};