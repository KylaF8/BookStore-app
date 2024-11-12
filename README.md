## Serverless REST Assignment - Distributed Systems.

__Name:__  Kyla Franks

__Demo:__ https://youtu.be/C2V0I5eLBqA

### Context. <br/>

#### A Bookstore Application

My distributed app is designed to manage a bookstore’s inventory and translations of book details. The primary focus is on creating, reading, updating, and deleting (CRUD) entries in the main table, which stores books as the resource.

##### The main database table for books includes attributes like:

book_id (Primary Key): Unique identifier for each book.
title: Title of the book.
author: Author's name.
genre: Genre or category of the book.
original_language: Original language of the book.

##### The main attributes for the Book Characters:

bookId: Unique identifier for the book the character belongs to.
characterName: The name of the character.
roleName: The role of the character.
roleDescription: The description of the character's role.

### App API endpoints. <br/>

#### Books

+ GET /books - Retrieve a list of all books.
+ GET /books/{book_id} - Retrieve details of a book by its unique ID.
+ POST /books - Add a new book.
+ GET /books/characters?bookId=1&characterName={characterName} - Retrieve books filtered by characterName.
+ GET /books/characters?bookId=1&roleName={characterName} - Retrieve books filtered by the roleName.
+ PUT /books/{book_id} - Update details of an existing book.
+ DELETE /books/{book_id} - Delete a book by its unique ID.

#### Translation

+ GET /books/{book_id}/Translate?language={language} - Retrieve a book and translates it based on the specified language.

### Update constraint (if relevant). <br/>

The user just needs to be authorised to make updates to a book, i.e. signed up and signed in, with the correct cookies.

### Translation persistence (if relevant). <br/>

The translated descriptions are stored in the database translation table. Each translation request first checks if the requested language exists for the given book. If present, it serves the stored translation directly; if not, it calls Amazon Translate, stores the new translation, and then responds to the user.

###  Extra (If relevant). <br/>
