const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(express.json());
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'https://my-marketplace-3a996.web.app',
        'https://my-marketplace-3a996.firebaseapp.com',
    ],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.send("RealState server is running");

});


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xyjw3s8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// my middleware
const logger = async (req, res, next) => {
    console.log("IN LOGGER");
    console.log('called: ', req.host, req.originalUrl);
    next();
}

const verifyToken = async (req, res, next) => {
    console.log("In VERIFYTOKEN");
    //     // console.log(req.cookies);
    const token = req.cookies?.token;
    console.log("Value of token in middleware: ", token);
    if (!token) {
        return res.status(401).send({ message: "not authorized" })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'not authorized' })
        }
        console.log("Value in the token: ", decoded);
        req.user = decoded;
        next();
    })

}

async function run() {
    try {
        // await client.connect();

        const database = client.db("RealStateDB");
        const PropertiesCollection = database.collection("Properties");

        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV==='production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('Logging out: ', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

        // Properties
        app.get("/properties", async (req, res) => {
            const cursor = PropertiesCollection.find();
            const result = await cursor.toArray();
            console.log(result);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Real State server is running on server ${port}`);
})