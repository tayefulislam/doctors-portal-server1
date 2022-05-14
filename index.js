const express = require("express");
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

// middle ware

app.use(cors())
app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.4puaa.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

console.log(uri)

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run() {

    try {


        await client.connect()

        const serviceCollection = client.db("doctorsPortal").collection("services")
        const bookingCollection = client.db("doctorsPortal").collection("booking")


        // all servies api
        app.get('/services', async (req, res) => {
            const query = {}

            const cursor = serviceCollection.find(query)
            const result = await cursor.toArray()

            res.send(result)
            console.log(result)
        })

        // booking api

        app.post('/booking', async (req, res) => {
            const booking = req.body;

            const result = await bookingCollection.insertOne(booking)
            res.send(result)
        })






    }

    finally {

    }
}

run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('server is runing')
})



app.listen(port, () => {
    console.log(`server is running ar port number ${port}`)
})