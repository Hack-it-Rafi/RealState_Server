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
        req.decoded = decoded;
        next();
    })

}

const verifyAdmin = async (req, res, next)=>{
    console.log("In verifyAdmin");
    const email = req.decoded.email;
    const query = {email:email}
    const user = await UsersCollection.findOne(query)
    const isAdmin = user?.role === 'admin';

    if(!isAdmin){
        return res.status(403).send({message : "forbidden access"})
    }
    next()
}

async function run() {
    try {
        // await client.connect();

        const database = client.db("RealStateDB");
        const PropertiesCollection = database.collection("Properties");
        const ReviewsCollection = database.collection("Reviews");
        const WishListCollection = database.collection("WishList");
        const UsersCollection = database.collection("Users");
        const OffersCollection = database.collection("Offers");

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

        // Users
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            console.log(newUser);

            const query = {email: newUser.email};
            const existingUser = await UsersCollection.findOne(query);

            if(existingUser){
                return res.send({message: "User already exists", insertedId: null})
            }
            const result = await UsersCollection.insertOne(newUser);
            res.send(result);
        })
        app.get("/users/admin/:email",verifyToken, async (req, res) => {
            const email =  req.params.email
            console.log("checking role",req.decoded);
            if(email !== req.decoded.email){
                res.status(403).send({message:"forbidden access"})
            }
            const query = {email:email}
            const user = await UsersCollection.findOne(query)
            console.log("user is",user);
            let role = "user"
            if(user){
                role = user?.role
                res.send({role})
            }
           
            
            // const cursor = UsersCollection.find();
            // const result = await cursor.toArray();
            // // console.log(result);
            // res.send(result);
        })

        

        // Properties
        app.get("/properties", async (req, res) => {
            const cursor = PropertiesCollection.find();
            const result = await cursor.toArray();
            // console.log(result);
            res.send(result);
        })
        app.get("/properties/:id", logger, verifyToken, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await PropertiesCollection.findOne(query);
            res.send(result);
        })
        app.post('/properties',async(req,res) => {
            const propertyData = req.body;
            console.log(propertyData);
            const result = await PropertiesCollection.insertOne(propertyData);
            res.send(result);
        })

        // Reviews
        app.post('/reviews', logger, verifyToken, async (req, res) => {
            const newReview = req.body;
            console.log(newReview);
            const result = await ReviewsCollection.insertOne(newReview);
            res.send(result);
        })
        app.get("/reviews", logger, verifyToken, async (req, res) => {
            try {
                const propId = req.query.reviewId;
                const query = { propId: propId };
                const options = {
                    sort: { rating: 1 },
                };
                const cursor = ReviewsCollection.find(query, options);
                const results = await cursor.toArray();
                res.send({ results });
            } catch (error) {
                console.error("Error fetching data:", error);
                res.status(500).send({ error: "Internal Server Error" });
            }
        });
        app.get("/myReviews", logger, async (req, res) => {
            try {
                const email = req.query.email;
                const query = { reviewer_email: email };
                const options = {
                    sort: { rating: 1 },
                };
                const cursor = ReviewsCollection.find(query, options);
                const results = await cursor.toArray();
                res.send({ results });
            } catch (error) {
                console.error("Error fetching data:", error);
                res.status(500).send({ error: "Internal Server Error" });
            }
        });

        // WishList
        app.post('/wishList', logger, verifyToken, async (req, res) => {
            const newReview = req.body;
            console.log(newReview);
            const result = await WishListCollection.insertOne(newReview);
            res.send(result);
        })
        app.get("/wishList", logger, async (req, res) => {
            const ownerEmail = req.query.email;
            // console.log(jobCat);
            const query = { ownerEmail: ownerEmail };
            console.log("afa",query);
            const options = {
                sort: { job_title: 1 },
            };
            const cursor = WishListCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.delete('/wishList/:id', logger, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await WishListCollection.deleteOne(query);
            res.send(result);
        })

        // Offer Properties
        app.post('/offeredProp', logger, async (req, res) => {
            const newOffer = req.body;
            console.log(newOffer);
            const result = await OffersCollection.insertOne(newOffer);
            res.send(result);
        })
        app.get("/offeredProp", logger, async (req, res) => {
            const ownerEmail = req.query.email;
            // console.log(jobCat);
            const query = { ownerEmail: ownerEmail };
            // console.log("afa",query);
            const options = {
                sort: { job_title: 1 },
            };
            const cursor = OffersCollection.find(query, options);
            const result = await cursor.toArray();
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