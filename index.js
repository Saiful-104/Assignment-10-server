
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
         const likesCollection = db.collection("likes")
         const favoritesCollection = db.collection("favorites")
          const usersCollection = db.collection("users");


         app.get("/artworks", async(req,res)=>{
                const result = await artworksCollection.find({ visibility: "Public" }).toArray()
                res.send(result)
         });

         app.get ("/artworks/:id", async (req,res)=> {
             const {id} = req.params;
             const objectId = new ObjectId(id);
             const result = await artworksCollection.findOne({_id: objectId});
           if(!result){
              return res.status(404).send({message: "Artwork not found" })
           }
           
            res.send ({ success: true, result })

         });

       app.post("/artworks", async ( req,res)=>{
           const data = req.body;
           data.createdAt = new Date();
           data.likes = 0;
           const result = await artworksCollection.insertOne(data);
           res.send({success: true, result})
       })  ;

       //update

       app.put ("/artworks/:id", async (req,res)=>{
        const id= req.params;
            const data = req.body;
            const filter = {_id: new ObjectId(id)};

            const update = {$set: data};

            const result = await artworksCollection.updateOne(filter,update);

            res.send({success: true , result});
       })

       //delete 

       app.delete("/artworks/:id", async(req,res) => {
           const {id} = req.params;
           const result =  await artworksCollection.deleteOne({_id: new ObjectId(id)});
           res.send({success: true , result})
       })

        //latest 6 artworks

        app.get("/latest-artworks", async (req,res)=>{
             const result = await artworksCollection.find({visibility:"Public"}).sort({createdAt:-1}).limit(6).toArray();
             res.send(result)

        })

//user's artworks 
      app.get("/my-artworks", async (req,res)=>{
         const email = req.user.email;
        const result =  await artworksCollection.find({userEmail : email}).toArray()
        res.send (result)

      })

      //Like / Unlike artwork
      app.post("/artworks/:id/like", async(req,res)=>{
           const {id} = req.params;
           const userId=  req.user.uid;

           const existingLike = await likesCollection.findOne({artworkId: id, userId})
           if(existingLike){
            await likesCollection.deleteOne({_id: existingLike._id})
            await artworksCollection.updateOne({_id: new ObjectId(id)}, {$inc: {likes:-1}})

            res.send({success:true,liked: false});
           }
           else{
             await likesCollection.insertOne({ artworkId: id, userId });
        await artworksCollection.updateOne({ _id: new ObjectId(id) }, { $inc: { likes: 1 } });
        res.send({ success: true, liked: true });
           }

      })

     // Add / Remove favorite

     app.post ("/artworks/:id/favorite", async(req,res)=>{
        const {id} = req.params;
        const userId=  req.user.uid;
        const userEmail = req.user.email;
        const existingFavorite = await favoritesCollection.findOne({ artworkId: id, userId });
         if(existingFavorite){
            await favoritesCollection.deleteOne({ _id: existingFavorite._id });
        res.send({ success: true, favorited: false });
         }
         else{
            await favoritesCollection.insertOne({ artworkId: id, userId, userEmail });
        res.send({ success: true, favorited: true });
         }
     })

     // user's favorites

     app.get("/my-favorites", async(req,res) =>{
         const  userId = req.user.uid;
         const favorites = await favoritesCollection.find({userId}).toArray();
         const artworkIds = favorites.map((fav)=> new ObjectId(fav.artworkId))
         const artworks = await  artworksCollection.find({_id: {$in: artworkIds}}).toArray()
         res.send(artworks)

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

