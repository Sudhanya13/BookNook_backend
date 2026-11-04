import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { jwtVerify, createRemoteJWKSet } from "jose";

const PORT = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize MongoDB Client
const client = new MongoClient(process.env.MONGO_URI);

async function run() {
  try {
    // Connect to MongoDB Database
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    // Specify Database Name and Collection Name
    const db = client.db("booknook");
    const addbooksCollection = db.collection("books");
    const borrowsCollection = db.collection("borrows");

    // Token Verification Middleware
    const verifyToken = async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        console.log("Auth Header:", authHeader);

        if (!authHeader) {
          return res.status(401).send({ message: "user unauthorized" });
        }

        const tokenParts = authHeader.split(" ");
        const token = tokenParts[1]; // Actual JWT string
        console.log("Extracted Token:", token);

        const JWKS = createRemoteJWKSet(
          new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
        );

        const { payload } = await jwtVerify(token, JWKS);
        console.log("Verified Payload:", payload);

        // Attach user info to request object
        req.user = payload;

        next();
      } catch (err) {
        console.error("Token verification failed:", err.message);
        return res.status(403).send({
          message: "Invalid or expired token",
          error: err.message,
        });
      }
    };

    // Root GET route
    app.get("/", (req, res) => {
      res.send("Express server is running successfully!");
    });

    // GET all books
    app.get("/all-books", async (req, res) => {
      try {
        const result = await addbooksCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching books:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch books from database",
        });
      }
    });

    // GET a single book by ID (Protected by verifyToken)
    app.get("/all-books/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const book = await addbooksCollection.findOne(query);

        if (!book) {
          return res.status(404).json({ error: "Book not found" });
        }

        res.json(book);
      } catch (err) {
        console.error("Error fetching book by ID:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // POST route to insert a book into MongoDB
    app.post("/add-book", async (req, res) => {
      try {
        const { title, author, category, cover, description, addedBy } =
          req.body;

        // Validate required information
        if (
          !title ||
          !author ||
          !category ||
          !cover ||
          !description ||
          !addedBy?.name ||
          !addedBy?.email
        ) {
          return res.status(400).send({
            success: false,
            message: "Please provide all required book information",
          });
        }

        // Prepare book data
        const bookData = {
          title,
          author,
          category,
          cover,
          description,
          addedBy: {
            name: addedBy.name,
            email: addedBy.email,
          },
          createdAt: new Date(),
        };

        const result = await addbooksCollection.insertOne(bookData);

        res.status(201).send({
          success: true,
          message: "Book added successfully!",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error inserting book:", error);
        res.status(500).send({
          success: false,
          message: "Failed to save book to database",
        });
      }
    });

    // GET books added by logged-in user
    app.get("/my-books", async (req, res) => {
      try {
        const email = req.query.email;

        const books = await addbooksCollection
          .find({ "addedBy.email": email })
          .toArray();

        res.send(books);
      } catch (error) {
        console.error("Error fetching user books:", error);
        res.status(500).send({ message: "Failed to fetch user books" });
      }
    });

    // DELETE a book by ID
    app.delete("/all-books/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid ID format" });
        }

        const result = await addbooksCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Book not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error deleting book:", error);
        res.status(500).send({ message: "Failed to delete book" });
      }
    });

    // ==================================
    // POST /my-borrows - Borrow a book
    // ==================================
    app.post("/my-borrows", async (req, res) => {
      try {
        const { bookId, userName, userEmail } = req.body;

        if (!ObjectId.isValid(bookId)) {
          return res.status(400).send({
            message: "Invalid book ID",
          });
        }

        if (!userName || !userEmail) {
          return res.status(400).send({
            message: "User information is required",
          });
        }

        const book = await addbooksCollection.findOne({
          _id: new ObjectId(bookId),
        });

        if (!book) {
          return res.status(404).send({
            message: "Book not found",
          });
        }

        // Prevent the same user borrowing the same book twice
        const existingBorrow = await borrowsCollection.findOne({
          bookId: book._id,
          userEmail: userEmail,
        });

        if (existingBorrow) {
          return res.status(409).send({
            message: "You have already borrowed this book",
          });
        }

        const borrowDate = new Date();
        const returnDate = new Date();
        returnDate.setDate(returnDate.getDate() + 7);

        const borrowData = {
          bookId: book._id,
          bookTitle: book.title,
          bookImage: book.cover,
          userName,
          userEmail,
          borrowDate,
          returnDate,
        };

        const result = await borrowsCollection.insertOne(borrowData);

        res.status(201).send({
          success: true,
          message: "Book borrowed successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Borrow book error:", error);
        res.status(500).send({
          message: "Failed to borrow book",
        });
      }
    });

    // ==================================
    // GET /my-borrows - Get user's borrowed books
    // ==================================
    app.get("/my-borrows", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({
            message: "Email is required",
          });
        }

        const borrowedBooks = await borrowsCollection
          .find({ userEmail: email })
          .toArray();

        res.send(borrowedBooks);
      } catch (error) {
        console.error("Fetch borrowed books error:", error);
        res.status(500).send({
          message: "Failed to fetch borrowed books",
        });
      }
    });

    // ==================================
    // DELETE /my-borrows/:id - Return book
    // ==================================
    app.delete("/my-borrows/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: "Invalid borrow ID",
          });
        }

        const result = await borrowsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            message: "Borrow record not found",
          });
        }

        res.send({
          success: true,
          message: "Book returned successfully",
        });
      } catch (error) {
        console.error("Return book error:", error);
        res.status(500).send({
          message: "Failed to return book",
        });
      }
    });

    // ==================================
    // GET latest books (New Arrivals)
    // ==================================
    app.get("/new-arrivals", async (req, res) => {
      try {
        const books = await addbooksCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send(books);
      } catch (error) {
        console.error("Error fetching new arrivals:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch new arrivals",
        });
      }
    });

    // Start Express server after successful DB connection
    app.listen(PORT, () => {
      console.log(`Server is listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run();

// // import express from "express";

// // import cors from "cors";

// // import "dotenv/config";

// // import { MongoClient } from "mongodb";

// // const PORT = process.env.PORT || 5000;

// // const app = express();
// // // const cors = require("cors");

// // // // import mongoclient

// // // require("dotenv").config();
// // // const app = express();
// // // const PORT = 3000;

// // // const client = new MongoClient(
// // //   "mongodb+srv://SmartCrud:TREVr0yPSJo4aLct@cluster0.efgcz4b.mongodb.net/",
// // // );

// // // middleware ----

// // app.use(cors());
// // app.use(express.json());

// // // Define a simple route
// // app.get("/", (req, res) => {
// //   res.send("Express server is running successfully!");

// //   // res.send(users);
// // });

// // // Start the server
// // app.listen(PORT, () => {
// //   console.log(`Server is listening on http://localhost:${PORT}`);
// // });

// // app.post("/add-book", (req, res) => {
// //   const data = req.body;
// //   console.log(data);
// //   res.send({ message: "API working" });
// // });

// // const client = new MongoClient(process.env.MONGO_URI);

// // export async function connectToMongoDB() {
// //   try {
// //     await client.connect();
// //     console.log("You successfully connected to MongoDB!");
// //     return client;
// //   } catch (err) {
// //     console.dir(err);
// //   }
// // }
// // connectToMongoDB();
// // // Call this only when your application terminates
// // // export async function disconnectFromMongoDB() {
// // //   await client.close();
// // // }

// import express from "express";
// import cors from "cors";
// import "dotenv/config";
// import { MongoClient } from "mongodb";

// const PORT = process.env.PORT || 5000;
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Initialize MongoDB Client
// const client = new MongoClient(process.env.MONGO_URI);

// async function run() {
//   try {
//     // Connect to MongoDB Database
//     await client.connect();
//     console.log("Successfully connected to MongoDB!");

//     // Specify Database Name and Collection Name
//     const db = client.db("booknook");
//     const addbooksCollection = db.collection("books");

//     // Root GET route
//     app.get("/", (req, res) => {
//       res.send("Express server is running successfully!");
//     });

//     app.get("/all-books", async (req, res) => {
//       try {
//         const result = await addbooksCollection.find().toArray();
//         res.send(result);
//       } catch (error) {
//         console.error("Error fetching books:", error);
//         res.status(500).send({
//           success: false,
//           message: "Failed to fetch books from database",
//         });
//       }
//     });

//     // POST route to insert a book into MongoDB
//     app.post("/add-book", async (req, res) => {
//       try {
//         const bookData = req.body;
//         console.log("Received Data:", bookData);

//         // Insert into MongoDB collection
//         const result = await addbooksCollection.insertOne(bookData);

//         res.status(201).send({
//           success: true,
//           message: "Book added successfully!",
//           insertedId: result.insertedId,
//         });
//       } catch (error) {
//         console.error("Error inserting book:", error);
//         res.status(500).send({
//           success: false,
//           message: "Failed to save book to database",
//         });
//       }
//     });
//     // Express.js backend example
//     app.get("/all-books/:id", async (req, res) => {
//       try {
//         const book = await Book.findById(req.params.id);
//         if (!book) return res.status(404).json({ error: "Book not found" });
//         res.json(book);
//       } catch (err) {
//         res.status(400).json({ error: "Invalid ID format" });
//       }
//     });

//     // Start Express server after successful DB connection
//     app.listen(PORT, () => {
//       console.log(`Server is listening on http://localhost:${PORT}`);
//     });
//   } catch (error) {
//     console.error("MongoDB Connection Error:", error);
//   }
// }

// run();
// import express from "express";
// import cors from "cors";
// import "dotenv/config";
// import { MongoClient, ObjectId } from "mongodb"; // 1. Added ObjectId here

// const PORT = process.env.PORT || 5000;
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Initialize MongoDB Client
// const client = new MongoClient(process.env.MONGO_URI);

// async function run() {
//   try {
//     // Connect to MongoDB Database
//     await client.connect();
//     console.log("Successfully connected to MongoDB!");

//     // Specify Database Name and Collection Name
//     const db = client.db("booknook");
//     const addbooksCollection = db.collection("books");
//     // const borrowsCollection = db.collection("borrows");

//     // app.post("/borrow-book", async (req, res) => {
//     //   try {
//     //     const borrowData = req.body;

//     //     const result = await borrowedBooksCollection.insertOne({
//     //       bookId: borrowData.bookId,
//     //       bookTitle: borrowData.bookTitle,
//     //       borrowerName: borrowData.borrowerName,
//     //       borrowerEmail: borrowData.borrowerEmail,
//     //       borrowDate: new Date(),
//     //       returnDate: borrowData.returnDate,
//     //       status: "borrowed",
//     //     });

//     //     res.send(result);
//     //   } catch (error) {
//     //     res.status(500).send({ message: "Failed to borrow book" });
//     //   }
//     // });

//     // app.get("/my-borrowed-books", async (req, res) => {
//     //   try {
//     //     const email = req.query.email;

//     //     const borrowedBooks = await borrowedBooksCollection
//     //       .find({ borrowerEmail: email })
//     //       .toArray();

//     //     res.send(borrowedBooks);
//     //   } catch (error) {
//     //     res.status(500).send({ message: "Failed to fetch borrowed books" });
//     //   }
//     // });
//     // app.patch("/return-book/:id", async (req, res) => {
//     //   try {
//     //     const id = req.params.id;

//     //     const result = await borrowedBooksCollection.updateOne(
//     //       { _id: new ObjectId(id) },
//     //       {
//     //         $set: {
//     //           status: "returned",
//     //           returnedAt: new Date(),
//     //         },
//     //       },
//     //     );

//     //     res.send(result);
//     //   } catch (error) {
//     //     res.status(500).send({ message: "Failed to return book" });
//     //   }
//     // });

//     // Root GET route
//     app.get("/", (req, res) => {
//       res.send("Express server is running successfully!");
//     });

//     app.get("/all-books", async (req, res) => {
//       try {
//         const result = await addbooksCollection.find().toArray();
//         res.send(result);
//       } catch (error) {
//         console.error("Error fetching books:", error);
//         res.status(500).send({
//           success: false,
//           message: "Failed to fetch books from database",
//         });
//       }
//     });

//     // 2. Fixed Route for Single Book using Native MongoDB Driver
//     app.get("/all-books/:id", async (req, res) => {
//       try {
//         const id = req.params.id;

//         // Validate if it's a valid MongoDB ObjectId format first
//         if (!ObjectId.isValid(id)) {
//           return res.status(400).json({ error: "Invalid ID format" });
//         }

//         const query = { _id: new ObjectId(id) };
//         const book = await addbooksCollection.findOne(query);

//         if (!book) {
//           return res.status(404).json({ error: "Book not found" });
//         }

//         res.json(book);
//       } catch (err) {
//         console.error("Error fetching book by ID:", err);
//         res.status(500).json({ error: "Internal server error" });
//       }
//     });

//     // POST route to insert a book into MongoDB
//     app.post("/add-book", async (req, res) => {
//       try {
//         const bookData = req.body;
//         console.log("Received Data:", bookData);

//         const result = await addbooksCollection.insertOne(bookData);

//         res.status(201).send({
//           success: true,
//           message: "Book added successfully!",
//           insertedId: result.insertedId,
//         });
//       } catch (error) {
//         console.error("Error inserting book:", error);
//         res.status(500).send({
//           success: false,
//           message: "Failed to save book to database",
//         });
//       }
//     });
//     // app.get("/my-books", async (req, res) => {
//     //   const email = req.query.email;

//     //   const books = await addbooksCollection
//     //     .find({ "addedBy.email": email })
//     //     .toArray();

//     //   res.send(books);
//     // });

//     // app.patch("/books/:id", async (req, res) => {
//     //   const id = req.params.id;
//     //   const updatedBook = req.body;

//     //   const result = await addbooksCollection.updateOne(
//     //     { _id: new ObjectId(id) },
//     //     {
//     //       $set: {
//     //         title: updatedBook.title,
//     //         author: updatedBook.author,
//     //         category: updatedBook.category,
//     //         cover: updatedBook.cover,
//     //         description: updatedBook.description,
//     //       },
//     //     },
//     //   );

//     //   res.send(result);
//     // });
//     // app.delete("/books/:id", async (req, res) => {
//     //   const id = req.params.id;

//     //   const result = await addbooksCollection.deleteOne({
//     //     _id: new ObjectId(id),
//     //   });

//     //   res.send(result);
//     // });

//     // Start Express server after successful DB connection
//     app.listen(PORT, () => {
//       console.log(`Server is listening on http://localhost:${PORT}`);
//     });
//   } catch (error) {
//     console.error("MongoDB Connection Error:", error);
//   }
// }

// run();

// import express from "express";
// import cors from "cors";
// import "dotenv/config";
// import { MongoClient, ObjectId } from "mongodb";

// const PORT = process.env.PORT || 5000;
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Initialize MongoDB Client
// const client = new MongoClient(process.env.MONGO_URI);

// async function run() {
//   try {
//     // Connect to MongoDB Database
//     await client.connect();
//     console.log("Successfully connected to MongoDB!");

//     // Specify Database Name and Collection Name
//     const db = client.db("booknook");
//     const addbooksCollection = db.collection("books");
//     const borrowsCollection = db.collection("borrows");

//     // Root GET route
//     app.get("/", (req, res) => {
//       res.send("Express server is running successfully!");
//     });

//     // GET all books
//     app.get("/all-books", async (req, res) => {
//       try {
//         const result = await addbooksCollection.find().toArray();
//         res.send(result);
//       } catch (error) {
//         console.error("Error fetching books:", error);
//         res.status(500).send({
//           success: false,
//           message: "Failed to fetch books from database",
//         });
//       }
//     });

//     // GET a single book by ID
//     app.get("/all-books/:id", async (req, res) => {
//       try {
//         const id = req.params.id;

//         if (!ObjectId.isValid(id)) {
//           return res.status(400).json({ error: "Invalid ID format" });
//         }

//         const query = { _id: new ObjectId(id) };
//         const book = await addbooksCollection.findOne(query);

//         if (!book) {
//           return res.status(404).json({ error: "Book not found" });
//         }

//         res.json(book);
//       } catch (err) {
//         console.error("Error fetching book by ID:", err);
//         res.status(500).json({ error: "Internal server error" });
//       }
//     });

//     // POST route to insert a book into MongoDB
//     // app.post("/add-book", async (req, res) => {
//     //   try {
//     //     const bookData = req.body;
//     //     console.log("Received Data:", bookData);

//     //     const result = await addbooksCollection.insertOne(bookData);

//     //     res.status(201).send({
//     //       success: true,
//     //       message: "Book added successfully!",
//     //       insertedId: result.insertedId,
//     //     });
//     //   } catch (error) {
//     //     console.error("Error inserting book:", error);
//     //     res.status(500).send({
//     //       success: false,
//     //       message: "Failed to save book to database",
//     //     });
//     //   }
//     // });

//    app.post("/add-book", async (req, res) => {
//   try {
//     const { title, author, category, cover, description, addedBy } =
//       req.body;

//     // Validate required information
//     if (
//       !title ||
//       !author ||
//       !category ||
//       !cover ||
//       !description ||
//       !addedBy?.name ||
//       !addedBy?.email
//     ) {
//       return res.status(400).send({
//         success: false,
//         message: "Please provide all required book information",
//       });
//     }

//     // Prepare book data
//     const bookData = {
//       title,
//       author,
//       category,
//       cover,
//       description,
//       addedBy: {
//         name: addedBy.name,
//         email: addedBy.email,
//       },
//       createdAt: new Date(),
//     };

//     const result = await addbooksCollection.insertOne(bookData);

//     res.status(201).send({
//       success: true,
//       message: "Book added successfully!",
//       insertedId: result.insertedId,
//     });
//   } catch (error) {
//     console.error("Error inserting book:", error);

//     res.status(500).send({
//       success: false,
//       message: "Failed to save book to database",
//     });
//   }
// });

//         const result = await addbooksCollection.insertOne(bookData);

//         res.status(201).send({
//           success: true,
//           message: "Book added successfully!",
//           insertedId: result.insertedId,
//         });
//       } catch (error) {
//         console.error("Error inserting book:", error);

//         res.status(500).send({
//           success: false,
//           message: "Failed to save book to database",
//         });
//       }

//     // GET books added by logged-in user
//     app.get("/my-books", async (req, res) => {
//       try {
//         const email = req.query.email;

//         // Matches userEmail sent from your frontend form
//         const books = await addbooksCollection
//           .find({ "addedBy.email": email })
//           .toArray();

//         res.send(books);
//       } catch (error) {
//         console.error("Error fetching user books:", error);
//         res.status(500).send({ message: "Failed to fetch user books" });
//       }
//     });

//     // DELETE a book by ID
//     app.delete("/all-books/:id", async (req, res) => {
//       try {
//         const id = req.params.id;

//         if (!ObjectId.isValid(id)) {
//           return res.status(400).send({ message: "Invalid ID format" });
//         }

//         const result = await addbooksCollection.deleteOne({
//           _id: new ObjectId(id),
//         });

//         if (result.deletedCount === 0) {
//           return res.status(404).send({ message: "Book not found" });
//         }

//         res.send(result);
//       } catch (error) {
//         console.error("Error deleting book:", error);
//         res.status(500).send({ message: "Failed to delete book" });
//       }
//     });

//     // ==================================
//     // 6. POST /borrows - Borrow a book
//     // ==================================
//     app.post("/my-borrows", async (req, res) => {
//       try {
//         const { bookId, userName, userEmail } = req.body;

//         if (!ObjectId.isValid(bookId)) {
//           return res.status(400).send({
//             message: "Invalid book ID",
//           });
//         }

//         if (!userName || !userEmail) {
//           return res.status(400).send({
//             message: "User information is required",
//           });
//         }

//         const book = await addbooksCollection.findOne({
//           _id: new ObjectId(bookId),
//         });

//         if (!book) {
//           return res.status(404).send({
//             message: "Book not found",
//           });
//         }

//         // Prevent the same user borrowing the same book twice
//         const existingBorrow = await borrowsCollection.findOne({
//           bookId: book._id,
//           userEmail: userEmail,
//         });

//         if (existingBorrow) {
//           return res.status(409).send({
//             message: "You have already borrowed this book",
//           });
//         }

//         const borrowDate = new Date();

//         const returnDate = new Date();
//         returnDate.setDate(returnDate.getDate() + 7);

//         const borrowData = {
//           bookId: book._id,
//           bookTitle: book.title,
//           bookImage: book.cover,
//           userName,
//           userEmail,
//           borrowDate,
//           returnDate,
//         };

//         const result = await borrowsCollection.insertOne(borrowData);

//         res.status(201).send({
//           success: true,
//           message: "Book borrowed successfully",
//           insertedId: result.insertedId,
//         });
//       } catch (error) {
//         console.error("Borrow book error:", error);
//         res.status(500).send({
//           message: "Failed to borrow book",
//         });
//       }
//     });

//     // ==================================
//     // 7. GET /borrows - Get user's borrowed books
//     // ==================================
//     app.get("/my-borrows", async (req, res) => {
//       try {
//         const email = req.query.email;

//         if (!email) {
//           return res.status(400).send({
//             message: "Email is required",
//           });
//         }

//         const borrowedBooks = await borrowsCollection
//           .find({ userEmail: email })
//           .toArray();

//         res.send(borrowedBooks);
//       } catch (error) {
//         console.error("Fetch borrowed books error:", error);
//         res.status(500).send({
//           message: "Failed to fetch borrowed books",
//         });
//       }
//     });

//     // ==================================
//     // 8. DELETE /borrows/:id - Return book
//     // ==================================
//     app.delete("/my-borrows/:id", async (req, res) => {
//       try {
//         const id = req.params.id;

//         if (!ObjectId.isValid(id)) {
//           return res.status(400).send({
//             message: "Invalid borrow ID",
//           });
//         }

//         const result = await borrowsCollection.deleteOne({
//           _id: new ObjectId(id),
//         });

//         if (result.deletedCount === 0) {
//           return res.status(404).send({
//             message: "Borrow record not found",
//           });
//         }

//         res.send({
//           success: true,
//           message: "Book returned successfully",
//         });
//       } catch (error) {
//         console.error("Return book error:", error);
//         res.status(500).send({
//           message: "Failed to return book",
//         });
//       }
//     });

//     // Start Express server after successful DB connection
//     app.listen(PORT, () => {
//       console.log(`Server is listening on http://localhost:${PORT}`);
//     });
//   } catch (error) {
//     console.error("MongoDB Connection Error:", error);
//   }
// }

// run();
