const express = require("express");
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
const port = process.env.PORT || 5000;

// middle ware

app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.4puaa.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

console.log(uri)

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



let transporter = nodemailer.createTransport({
    host: "mail.priyopathshala.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: "tayeful1@priyopathshala.com", // generated ethereal user
        pass: process.env.SENDER_PASS, // generated ethereal password
    },
})



// jwt verify
function jwtVerify(req, res, next) {

    const authorization = req.headers.authorization;

    // console.log('line 32', authorization)

    const token = authorization?.split(' ')[1]
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized' })
    }

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {

        if (err) {
            return res.status(403).send({ message: 'Access Forbiden' })
        }

        req.decoded = decoded

        console.log(decoded)
        next()
    });


}

const bookingEmail = async (booking) => {

    console.log(booking)

    let info = await transporter.sendMail({
        from: `tayeful1@priyopathshala.com`, // sender address

        to: booking?.patientEmail, // list of receivers
        subject: `Appointment Confirmation for ${booking?.treatment}`, // Subject line
        text: `Dear ${booking?.patientEmail}
        You have A Appointment on ${booking?.date} at ${booking?.slot}  Please come in time 
        Best Wishes,
        
        Doctors Portal En.`,
        html: `<h1> Dear ${booking?.patientEmail}</h1> <br>
        You have A Appointment on ${booking?.date} at ${booking?.slot} <br> Please come in time <br>
        Best Wishes,
        <br>
        Doctors Portal En.`, // html body
    });

    return ("Message sent: %s", info.messageId)


}






async function run() {

    try {


        await client.connect()

        const serviceCollection = client.db("doctorsPortal").collection("services")
        const bookingCollection = client.db("doctorsPortal").collection("booking")
        const userCollection = client.db("doctorsPortal").collection("user")
        const doctorCollection = client.db("doctorsPortal").collection("doctors")


        // common function

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;

            const requesterAccount = await userCollection.findOne({ email: requester })

            // console.log('line 126', requesterAccount)

            if (requesterAccount.role === 'admin') {

                next()
            }

            else {
                res.status(403).send({ message: 'Forbiden' })
            }



        }

        // all users 

        app.get('/users', jwtVerify, async (req, res) => {

            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.get('/user', async (req, res) => {

            const users = await userCollection.find().toArray()
            res.send(users)
        })




        // all servies api
        app.get('/services', async (req, res) => {
            const query = {}

            const cursor = serviceCollection.find(query)
            const result = await cursor.toArray()

            res.send(result)
            console.log(result)
        })



        app.get('/servicesName', async (req, res) => {
            const query = {}

            const cursor = serviceCollection.find(query).project({ name: 1 })
            const result = await cursor.toArray()

            res.send(result)
            console.log(result)
        })






        //add user
        app.put('/user/:email', async (req, res) => {

            const email = req.params.email;
            const user = req.body;

            const filter = { email: email };

            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };

            const result = await userCollection.updateOne(filter, updateDoc, options)

            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })


            res.send({ result, token })


        })


        // is admin check

        app.get('/admin/:email', jwtVerify, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin';

            res.send({ isAdmin: isAdmin })

        })


        // make admin
        app.put('/user/admin/:email', jwtVerify, async (req, res) => {

            const email = req.params.email;

            const filter = { email: email };

            const updateDoc = { $set: { role: 'admin' } };

            const result = await userCollection.updateOne(filter, updateDoc)

            console.log(result)

            res.send(result)


        })


        app.put('/user/user/:email', async (req, res) => {

            const email = req.params.email;
            const filter = { email: email };


            const updateDoc = { $set: { role: 'user' } };

            const result = await userCollection.updateOne(filter, updateDoc)

            console.log(result)


            res.send(result)


        })



        // avaible 

        app.get('/available', async (req, res) => {

            const date = req.query.date;


            // step 1 : get all services

            const services = await serviceCollection.find().toArray();

            // step 2: get bookings of that day

            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();


            // step 3 : 

            services.forEach(service => {

                const servicesBooking = bookings.filter(booking => booking.treatment === service.name)

                // console.log('servicesBooking', servicesBooking)

                const bookedSolts = servicesBooking.map(book => book.slot)

                // console.log('booked', bookedSolts)

                const available = service.slots.filter(slot => !bookedSolts.includes(slot))

                // console.log('available', available)

                service.slots = available;


            })




            res.send(services)

        })


        // get bookings   by email  query

        app.get('/booking', jwtVerify, async (req, res) => {
            const email = req.query.patientEmail;

            const emailDecoded = req.decoded.email;

            if (email === emailDecoded) {
                const query = { patientEmail: email };
                const bookings = await bookingCollection.find(query).toArray()
                // console.log(bookings)
                return res.send(bookings)

            }

            else {

                return res.status(403).send({ message: "Forbiden access" })
            }


        })

        // get booking detail by id

        app.get('/booking/:id', jwtVerify, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await bookingCollection.findOne(query)
            res.send(result)
        })


        // booking api

        app.post('/booking', async (req, res) => {

            const booking = req.body;

            const query = { treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail }
            bookingEmail(booking)

            const exist = await bookingCollection.findOne(query);

            if (exist) {
                return res.send({ success: false, exist })
            }

            const result = await bookingCollection.insertOne(booking)
            res.send({ success: true, result })
        })


        // get all doctor 

        app.get('/doctors', jwtVerify, verifyAdmin, async (req, res) => {
            const result = await doctorCollection.find().toArray()
            res.send(result)
        })

        // add doctor

        app.post('/addDoctor', jwtVerify, verifyAdmin, async (req, res) => {

            const doctor = req.body;

            const result = await doctorCollection.insertOne(doctor)

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