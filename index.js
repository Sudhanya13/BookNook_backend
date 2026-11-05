// import express from "express";
// import cors from "cors";
// import "dotenv/config";
// import { MongoClient, ObjectId } from "mongodb";
// import { jwtVerify, createRemoteJWKSet } from "jose";

// const PORT = process.env.PORT || 5000;
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Initialize MongoDB Client
// const client = new MongoClient(process.env.MONGO_URI);

//  async function run() {
//   try {
//     // Connect to MongoDB Database
//     // await client.connect();
//     console.log("Successfully connected to MongoDB!");

//     // Specify Database Name and Collection Name
//     const db = client.db("booknook");
//     const addbooksCollection = db.collection("books");
//     const borrowsCollection = db.collection("borrows");
//     // Prevent a user from having two active borrows of the same book
//     await borrowsCollection.createIndex(
//       { bookId: 1, userEmail: 1 },
//       { unique: true },
//     );

//     // Token Verification Middleware
//     const verifyToken = async (req, res, next) => {
//       try {
//         const authHeader = req.headers.authorization;
//         console.log("Auth Header:", authHeader);

//         if (!authHeader) {
//           return res.status(401).send({ message: "user unauthorized" });
//         }

//         const tokenParts = authHeader.split(" ");
//         const token = tokenParts[1]; // Actual JWT string
//         console.log("Extracted Token:", token);

//         const JWKS = createRemoteJWKSet(
//           new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
//         );

//         const { payload } = await jwtVerify(token, JWKS);
//         console.log("Verified Payload:", payload);

//         // Attach user info to request object
//         req.user = payload;

//         next();
//       } catch (err) {
//         console.error("Token verification failed:", err.message);
//         return res.status(403).send({
//           message: "Invalid or expired token",
//           error: err.message,
//         });
//       }
//     };

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

//     // GET a single book by ID (Protected by verifyToken)
//     app.get("/all-books/:id", verifyToken, async (req, res) => {
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

//     // Update book
//     app.put("/all-books/:id", async (req, res) => {
//       try {
//         const { id } = req.params;

//         if (!ObjectId.isValid(id)) {
//           return res.status(400).send({
//             message: "Invalid book ID",
//           });
//         }

//         const { title, author, category, cover, description } = req.body;

//         if (!title || !author || !category || !cover || !description) {
//           return res.status(400).send({
//             message: "All book fields are required",
//           });
//         }

//         const result = await addbooksCollection.updateOne(
//           { _id: new ObjectId(id) },
//           {
//             $set: {
//               title,
//               author,
//               category,
//               cover,
//               description,
//             },
//           },
//         );

//         if (result.matchedCount === 0) {
//           return res.status(404).send({
//             message: "Book not found",
//           });
//         }

//         res.send({
//           success: true,
//           message: "Book updated successfully",
//         });
//       } catch (error) {
//         console.error("Update book error:", error);

//         res.status(500).send({
//           message: "Failed to update book",
//         });
//       }
//     });

//     // POST route to insert a book into MongoDB
//     app.post("/add-book", async (req, res) => {
//       try {
//         const { title, author, category, copies, cover, description, addedBy } =
//           req.body;

//         // Validate required information
//         if (
//           !title ||
//           !author ||
//           !category ||
//           !Number.isInteger(Number(copies)) ||
//           Number(copies) < 1 ||
//           !cover ||
//           !description ||
//           !addedBy?.name ||
//           !addedBy?.email
//         ) {
//           return res.status(400).send({
//             success: false,
//             message: "Please provide all required book information",
//           });
//         }

//         // Prepare book data
//         const bookData = {
//           title,
//           author,
//           category,
//           cover,
//           totalCopies: Number(copies), // Original total copies
//           copies: Number(copies), // Currently available copies
//           description,
//           addedBy: {
//             name: addedBy.name,
//             email: addedBy.email,
//           },
//           createdAt: new Date(),
//         };

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

//     // GET books added by logged-in user
//     app.get("/my-books", async (req, res) => {
//       try {
//         const email = req.query.email;

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
//     // POST /my-borrows - Borrow a book
//     // ==================================
//     // app.post("/my-borrows", async (req, res) => {
//     //   try {
//     //     const { bookId, userName, userEmail } = req.body;

//     //     if (!ObjectId.isValid(bookId)) {
//     //       return res.status(400).send({
//     //         message: "Invalid book ID",
//     //       });
//     //     }

//     //     if (!userName || !userEmail) {
//     //       return res.status(400).send({
//     //         message: "User information is required",
//     //       });
//     //     }

//     //     const book = await addbooksCollection.findOne({
//     //       _id: new ObjectId(bookId),
//     //     });

//     //     if (!book) {
//     //       return res.status(404).send({
//     //         message: "Book not found",
//     //       });
//     //     }

//     //     // Prevent the same user borrowing the same book twice
//     //     const existingBorrow = await borrowsCollection.findOne({
//     //       bookId: book._id,
//     //       userEmail: userEmail,
//     //     });

//     //     if (existingBorrow) {
//     //       return res.status(409).send({
//     //         message: "You have already borrowed this book",
//     //       });
//     //     }

//     //     const borrowDate = new Date();
//     //     const returnDate = new Date();
//     //     returnDate.setDate(returnDate.getDate() + 7);

//     //     const borrowData = {
//     //       bookId: book._id,
//     //       bookTitle: book.title,
//     //       bookImage: book.cover,
//     //       userName,
//     //       userEmail,
//     //       borrowDate,
//     //       returnDate,
//     //     };

//     //     const result = await borrowsCollection.insertOne(borrowData);

//     //     res.status(201).send({
//     //       success: true,
//     //       message: "Book borrowed successfully",
//     //       insertedId: result.insertedId,
//     //     });
//     //   } catch (error) {
//     //     console.error("Borrow book error:", error);
//     //     res.status(500).send({
//     //       message: "Failed to borrow book",
//     //     });
//     //   }
//     // });
//     // POST /my-borrows - Borrow a book
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

//         const bookObjectId = new ObjectId(bookId);

//         const book = await addbooksCollection.findOne({
//           _id: bookObjectId,
//         });

//         if (!book) {
//           return res.status(404).send({
//             message: "Book not found",
//           });
//         }

//         // Check if user already borrowed this book
//         const existingBorrow = await borrowsCollection.findOne({
//           bookId: bookObjectId,
//           userEmail,
//         });

//         if (existingBorrow) {
//           return res.status(409).send({
//             message: "You have already borrowed this book!",
//           });
//         }

//         // Decrease available copies by 1
//         // Only update if copies are greater than 0
//         const updateResult = await addbooksCollection.updateOne(
//           {
//             _id: bookObjectId,
//             copies: { $gt: 0 },
//           },
//           {
//             $inc: { copies: -1 },
//           },
//         );

//         if (updateResult.modifiedCount === 0) {
//           return res.status(409).send({
//             message: "This book is not available right now!",
//           });
//         }

//         const borrowDate = new Date();
//         const returnDate = new Date();
//         returnDate.setDate(returnDate.getDate() + 7);

//         const borrowData = {
//           bookId: bookObjectId,
//           bookTitle: book.title,
//           bookImage: book.cover,
//           userName,
//           userEmail,
//           borrowDate,
//           returnDate,
//         };

//         try {
//           const result = await borrowsCollection.insertOne(borrowData);

//           return res.status(201).send({
//             success: true,
//             message: "Book borrowed successfully",
//             insertedId: result.insertedId,
//           });
//         } catch (error) {
//           // Restore the copy if inserting the borrow record fails
//           await addbooksCollection.updateOne(
//             { _id: bookObjectId },
//             { $inc: { copies: 1 } },
//           );

//           // Handle simultaneous duplicate borrowing
//           if (error.code === 11000) {
//             return res.status(409).send({
//               message: "You have already borrowed this book!",
//             });
//           }

//           throw error;
//         }
//       } catch (error) {
//         console.error("Borrow book error:", error);

//         res.status(500).send({
//           message: "Failed to borrow book",
//         });
//       }
//     });

//     // ==================================
//     // GET /my-borrows - Get user's borrowed books
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
//     // DELETE /my-borrows/:id - Return book
//     // ==================================
//     // app.delete("/my-borrows/:id", async (req, res) => {
//     //   try {
//     //     const id = req.params.id;

//     //     if (!ObjectId.isValid(id)) {
//     //       return res.status(400).send({
//     //         message: "Invalid borrow ID",
//     //       });
//     //     }

//     //     const result = await borrowsCollection.deleteOne({
//     //       _id: new ObjectId(id),
//     //     });

//     //     if (result.deletedCount === 0) {
//     //       return res.status(404).send({
//     //         message: "Borrow record not found",
//     //       });
//     //     }

//     //     res.send({
//     //       success: true,
//     //       message: "Book returned successfully",
//     //     });
//     //   } catch (error) {
//     //     console.error("Return book error:", error);
//     //     res.status(500).send({
//     //       message: "Failed to return book",
//     //     });
//     //   }
//     // });
//     // DELETE /my-borrows/:id - Return book
//     // app.delete("/my-borrows/:id", async (req, res) => {
//     //   try {
//     //     const id = req.params.id;

//     //     if (!ObjectId.isValid(id)) {
//     //       return res.status(400).send({
//     //         message: "Invalid borrow ID",
//     //       });
//     //     }

//     //     const borrowId = new ObjectId(id);

//     //     // Find the borrow record
//     //     const borrow = await borrowsCollection.findOne({
//     //       _id: borrowId,
//     //     });

//     //     if (!borrow) {
//     //       return res.status(404).send({
//     //         message: "Borrow record not found",
//     //       });
//     //     }

//     //     // Delete the borrow record
//     //     const result = await borrowsCollection.deleteOne({
//     //       _id: borrowId,
//     //     });

//     //     if (result.deletedCount === 0) {
//     //       return res.status(409).send({
//     //         message: "This book has already been returned",
//     //       });
//     //     }

//     //     // Increase available copies by 1
//     //     await addbooksCollection.updateOne(
//     //       {
//     //         _id: borrow.bookId,
//     //       },
//     //       {
//     //         $inc: { copies: 1 },
//     //       },
//     //     );

//     //     res.send({
//     //       success: true,
//     //       message: "Book returned successfully",
//     //     });
//     //   } catch (error) {
//     //     console.error("Return book error:", error);

//     //     res.status(500).send({
//     //       message: "Failed to return book",
//     //     });
//     //   }
//     // });

//     app.delete("/my-borrows/:id", async (req, res) => {
//       try {
//         const id = req.params.id;

//         if (!ObjectId.isValid(id)) {
//           return res.status(400).send({
//             message: "Invalid borrow ID",
//           });
//         }

//         const borrowId = new ObjectId(id);

//         // Find the borrow record
//         const borrow = await borrowsCollection.findOne({
//           _id: borrowId,
//         });

//         if (!borrow) {
//           return res.status(404).send({
//             message: "Borrow record not found",
//           });
//         }

//         // Delete the borrow record
//         const result = await borrowsCollection.deleteOne({
//           _id: borrowId,
//         });

//         if (result.deletedCount === 0) {
//           return res.status(409).send({
//             message: "Book has already been returned",
//           });
//         }

//         // Increase available copies by 1
//         await addbooksCollection.updateOne(
//           { _id: borrow.bookId },
//           { $inc: { copies: 1 } },
//         );

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

//     // ==================================
//     // GET latest books (New Arrivals)
//     // ==================================
//     app.get("/new-arrivals", async (req, res) => {
//       try {
//         const books = await addbooksCollection
//           .find()
//           .sort({ createdAt: -1 })
//           .limit(6)
//           .toArray();

//         res.send(books);
//       } catch (error) {
//         console.error("Error fetching new arrivals:", error);
//         res.status(500).send({
//           success: false,
//           message: "Failed to fetch new arrivals",
//         });
//       }
//     });

//     // Start Express server after successful DB connection
//   } catch (error) {
//     console.error("MongoDB Connection Error:", error);
//   }
// }
// run();
// // Root GET route
// app.get("/", (req, res) => {
//   res.send("Express server is running successfully!");
// });
// // server run due to this
// app.listen(PORT, () => {
//   console.log(`Server is listening on http://localhost:${PORT}`);
// });

// export default app;

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

// Ensure MONGO_URI is defined
if (!process.env.MONGO_URI) {
  console.error(
    "Please define the MONGO_URI environment variable inside Vercel or your .env file.",
  );
}

// Global variable to cache the MongoDB client across serverless invocations
let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  cachedClient = client;
  console.log("Successfully connected to MongoDB!");
  return cachedClient;
}

// Helper to quickly access collections with caching
async function getCollections() {
  const client = await connectToDatabase();
  const db = client.db("booknook");
  return {
    addbooksCollection: db.collection("books"),
    borrowsCollection: db.collection("borrows"),
  };
}

// Token Verification Middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: "user unauthorized" });
    }

    const tokenParts = authHeader.split(" ");
    const token = tokenParts[1];

    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );

    const { payload } = await jwtVerify(token, JWKS);
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

// ==================================
// ROUTES
// ==================================

// Root GET route
app.get("/", (req, res) => {
  res.send("Express server is running successfully!");
});

// GET all books
app.get("/all-books", async (req, res) => {
  try {
    const { addbooksCollection } = await getCollections();
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

    const { addbooksCollection } = await getCollections();
    const book = await addbooksCollection.findOne({ _id: new ObjectId(id) });

    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.json(book);
  } catch (err) {
    console.error("Error fetching book by ID:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update book
app.put("/all-books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid book ID" });
    }

    const { title, author, category, cover, description } = req.body;

    if (!title || !author || !category || !cover || !description) {
      return res.status(400).send({ message: "All book fields are required" });
    }

    const { addbooksCollection } = await getCollections();
    const result = await addbooksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { title, author, category, cover, description } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.send({ success: true, message: "Book updated successfully" });
  } catch (error) {
    console.error("Update book error:", error);
    res.status(500).send({ message: "Failed to update book" });
  }
});

// POST route to insert a book into MongoDB
app.post("/add-book", async (req, res) => {
  try {
    const { title, author, category, copies, cover, description, addedBy } =
      req.body;

    if (
      !title ||
      !author ||
      !category ||
      !Number.isInteger(Number(copies)) ||
      Number(copies) < 1 ||
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

    const bookData = {
      title,
      author,
      category,
      cover,
      totalCopies: Number(copies),
      copies: Number(copies),
      description,
      addedBy: {
        name: addedBy.name,
        email: addedBy.email,
      },
      createdAt: new Date(),
    };

    const { addbooksCollection } = await getCollections();
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
app.get("/my-books", verifyToken, async (req, res) => {
  try {
    const email = req.query.email;
    const { addbooksCollection } = await getCollections();
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

    const { addbooksCollection } = await getCollections();
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

// POST /my-borrows - Borrow a book
app.post("/my-borrows", async (req, res) => {
  try {
    const { bookId, userName, userEmail } = req.body;

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).send({ message: "Invalid book ID" });
    }

    if (!userName || !userEmail) {
      return res.status(400).send({ message: "User information is required" });
    }

    const bookObjectId = new ObjectId(bookId);
    const { addbooksCollection, borrowsCollection } = await getCollections();

    const book = await addbooksCollection.findOne({ _id: bookObjectId });
    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    const existingBorrow = await borrowsCollection.findOne({
      bookId: bookObjectId,
      userEmail,
    });

    if (existingBorrow) {
      return res
        .status(409)
        .send({ message: "You have already borrowed this book!" });
    }

    const updateResult = await addbooksCollection.updateOne(
      { _id: bookObjectId, copies: { $gt: 0 } },
      { $inc: { copies: -1 } },
    );

    if (updateResult.modifiedCount === 0) {
      return res
        .status(409)
        .send({ message: "This book is not available right now!" });
    }

    const borrowDate = new Date();
    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + 7);

    const borrowData = {
      bookId: bookObjectId,
      bookTitle: book.title,
      bookImage: book.cover,
      userName,
      userEmail,
      borrowDate,
      returnDate,
    };

    try {
      const result = await borrowsCollection.insertOne(borrowData);
      return res.status(201).send({
        success: true,
        message: "Book borrowed successfully",
        insertedId: result.insertedId,
      });
    } catch (error) {
      await addbooksCollection.updateOne(
        { _id: bookObjectId },
        { $inc: { copies: 1 } },
      );

      if (error.code === 11000) {
        return res
          .status(409)
          .send({ message: "You have already borrowed this book!" });
      }

      throw error;
    }
  } catch (error) {
    console.error("Borrow book error:", error);
    res.status(500).send({ message: "Failed to borrow book" });
  }
});

// GET /my-borrows - Get user's borrowed books
app.get("/my-borrows", verifyToken, async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const { borrowsCollection } = await getCollections();
    const borrowedBooks = await borrowsCollection
      .find({ userEmail: email })
      .toArray();
    res.send(borrowedBooks);
  } catch (error) {
    console.error("Fetch borrowed books error:", error);
    res.status(500).send({ message: "Failed to fetch borrowed books" });
  }
});

// DELETE /my-borrows/:id - Return book
app.delete("/my-borrows/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid borrow ID" });
    }

    const borrowId = new ObjectId(id);
    const { addbooksCollection, borrowsCollection } = await getCollections();

    const borrow = await borrowsCollection.findOne({ _id: borrowId });
    if (!borrow) {
      return res.status(404).send({ message: "Borrow record not found" });
    }

    const result = await borrowsCollection.deleteOne({ _id: borrowId });
    if (result.deletedCount === 0) {
      return res
        .status(409)
        .send({ message: "Book has already been returned" });
    }

    await addbooksCollection.updateOne(
      { _id: borrow.bookId },
      { $inc: { copies: 1 } },
    );

    res.send({
      success: true,
      message: "Book returned successfully",
    });
  } catch (error) {
    console.error("Return book error:", error);
    res.status(500).send({ message: "Failed to return book" });
  }
});

// GET latest books (New Arrivals)
app.get("/new-arrivals", async (req, res) => {
  try {
    const { addbooksCollection } = await getCollections();
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

// Start Express server locally if not in production
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
}

export default app;
