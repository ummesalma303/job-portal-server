const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 5000;

/* -------------------------------- middleware ------------------------------- */
// app.use(cors());
app.use(express.json());
app.use(cookieParser())

// configure cookie

app.use(cors({
  origin: ["http://localhost:5173"],
  credentials:true
}))

const logger =(req,res,next)=>{
  console.log('i am a middleware')
  next()
}

const verifyToken=(req,res,next)=>{
  const token = req?.cookies?.token
  if (!token){
    return res.status(401).send({message:'unAuthorized access'})
  }
  // console.log('cuk cuk cuk cookies', token)
  jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
    // console.log(decoded)
    if(err){
      return res.status(401).send({message:'your token not matched.unAuthorized access'})
    }
    req.user = decoded
    next()
  })
}


// const uri ='mongodb://localhost:27017';
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_pass}@cluster0.ot76b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const jobsCollection = client.db("job-portal").collection("jobs");
    const jobApplicationCollection = client
      .db("job-portal")
      .collection("jobs-application");


      /* -------------------------------- jwt token ------------------------------- */
      app.post('/jwt',(req,res)=>{
        const user = req.body
        const token = jwt.sign(user,process.env.JWT_SECRET,{ expiresIn: '6h' })
        console.log(token)
        res.cookie('token',token,{httpOnly:true,secure:false}).send({success:true})
      })

    /* ------------------------------  jobs related APIs ------------------------------ */
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });
    /* -----------------------------  jobs related APIs ---------------------------- */
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    /* -------------------------------- post data ------------------------------- */
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      // console.log(result)
      res.send(result);
    });

    /* -------------------------- job application apis -------------------------- */
    app.get("/jobApplications/:id", async (req, res) => {
      const jobId = req.params.id;
      // const query = {job_id: new ObjectId(id)}
      const query = { job_id: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      // console.log(result)
      res.send(result);
    });

    /* -------------------------- job update status api ------------------------- */

    app.patch("/job-applications/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await jobApplicationCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    /* -------------------------- job application apis -------------------------- */
    app.post("/job-applications", async (req, res) => {
      const data = req.body;
      const result = await jobApplicationCollection.insertOne(data);
    
      const id = data.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);
      console.log(job);

      let count = 0;
      if (job.applicationCount) {
        count = job.applicationCount + 1;
      } else {
        count = 1;
      }
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          applicationCount: count,
        },
      };
      const updateResult = await jobsCollection.updateOne(filter, updateDoc);
      console.log(updateResult);
      res.send(result);
    });

    /* ------------------------ get job Application data ------------------------ */

    app.get("/job-applications",logger,verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };
        // console.log('cuk cuk cuk cookies', req.cookies)
      if (req.user.email !== email) {
        return res.status(403).send({message:'forbidden access'})
      }
      

      const result = await jobApplicationCollection.find(query).toArray();
     
      for (const applicant of result) {
        // console.log(applicant.job_id)
        const query1 = { _id: new ObjectId(applicant.job_id) };
        const job = await jobsCollection.findOne(query1);
        // console.log(job);
        //  res.send(job);
        if (job) {
          applicant.title = job.title;
          applicant.location = job.location;
          applicant.company = job.company;
          applicant.company_logo = job.company_logo;
        }
      }
      // console.log("146 number ", result);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job is falling from the sky");
});
app.listen(port, () => {
  console.log(`job is waiting at: ${port}`);
});
