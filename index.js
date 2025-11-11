
const express= require("express")
const cors= require("cors")

require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");


const admin = require("firebase-admin")
const serviceAccount = require("./serviceKey.json");
const app = express();

const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri =
  `mongodb+srv://${process.env.DB_username}:${process.env.DB_pass}@cluster.q6zx4gw.mongodb.net/?appName=Cluster`;

  const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
  
   async function run() {
    try{
     
         await client.connect() ; 

         const db= client.db("Assignment-10")

         const artworksCollection = db.collection("artworks");


         app.get("/artworks", async(req,res)=>{
                const result = await artworksCollection.find({ visibility: "Public" }).toArray()
                res.send(result)
         })

         app.get ("/artworks/:id", async (req,res)=> {
             const {id} = req.params;
             const objectId = new ObjectId(id);
             const result = await artworksCollection.findOne({_id: objectId});
           if(!result){
              return res.status(404).send({message: "Artwork not found" })
           }
           
            res.send ({ success: true, result })

         })

       app.post("/artworks", async ( req,res)=>{
        
       })  

       

    }
    finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
   }
   run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.listen(port, () => {
  console.log(`Mongo Connected  on port ${port}`)
})

