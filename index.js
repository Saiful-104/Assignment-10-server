
const express= require("express")
const cors= require("cors")

require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");


const admin = require("firebase-admin")
const serviceAccount = require("./serviceKey.json");
const app = express();

const port = process.env.PORT || 3000;


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
  
 const verifyToken = async(req,res,next) => {
    const authorization = req.headers.authorization;

    if(!authorization){
        return res.status(401).send({message : "Unauthorized access. Token not found"  });

    }
    const token = authorization.split(' ')[1];

    try {
      // await admin.auth().verifyIdToken(token);
           const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; 
        next();
    }
    catch(error){
        return res.status(401).send({message: "Unauthorized access. Invalid token" })
    }

 }
 
   async function run() {
    try{
     
        // await client.connect() ; 

         const db= client.db("Assignment-10")

         const artworksCollection = db.collection("artworks");
         const likesCollection = db.collection("likes")
         const favoritesCollection = db.collection("favorites")
          const usersCollection = db.collection("users");


         app.get("/artworks", async(req,res)=>{
                const result = await artworksCollection.find({ visibility: { $regex: /^public$/i }}).toArray()
                res.send(result)
         });

         app.get ("/artworks/:id", async (req,res)=> {
             const {id} = req.params;
             const objectId = new ObjectId(id);
             const result = await artworksCollection.findOne({_id: objectId});
           if(!result){
              return res.status(404).send({message: "Artwork not found" })
           }

           let liked = false;
            let favorited = false;
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
              try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                const userId = decodedToken.uid;
                const isLiked = await likesCollection.findOne({ artworkId: id, userId });
                liked = !!isLiked;
                const isFavorited = await favoritesCollection.findOne({ artworkId: id, userId });
                favorited = !!isFavorited;
              //  console.log("aaaa",decodedToken);
              }
              catch(err){
                 console.log("Invalid token on detail page");
              }
            } 

           
            res.send ({ success: true,
               result:{
                ...result,
                liked,
                favorited,
               },
               })

         });
         // post method
    //  insertOne
    //  insertMany

       app.post("/artworks", async ( req,res)=>{
           const data = req.body;
           data.createdAt = new Date();
           data.likes = 0;
           const result = await artworksCollection.insertOne(data);
           res.send({success: true, result})
       })  ;

        
      
   
      // In your PUT route, you should also return the updated document
app.put("/artworks/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    let data = req.body;

    if (data.price) data.price = Number(data.price);

    const filter = { _id: new ObjectId(id), userEmail: req.user.email };
    const update = { $set: data };

    const result = await artworksCollection.updateOne(filter, update);

    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Artwork not found or unauthorized" 
      });
    }

    // Optional: Return updated document
    const updatedArtwork = await artworksCollection.findOne({ _id: new ObjectId(id) });

    res.json({ success: true, result, artwork: updatedArtwork });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

      
      app.delete("/artworks/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await artworksCollection.deleteOne({ _id: new ObjectId(id), userEmail: req.user.email });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Artwork not found or unauthorized" });
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


        //latest 6 artworks

        app.get("/latest-artworks", async (req,res)=>{
             const result = await artworksCollection.find({ visibility: { $regex: /^public$/i }}).sort({createdAt:-1}).limit(6).toArray();
             res.send(result)

        })


    app.get("/my-artworks", verifyToken, async (req, res) => {
  const email = req.user.email;
  const result = await artworksCollection.find({ userEmail: email }).toArray();

  const formatted = result.map(a => ({
    ...a,
    _id: a._id.toString(),
    price: typeof a.price === "object" ? parseInt(a.price.$numberInt) : a.price,
    likes: typeof a.likes === "object" ? parseInt(a.likes.$numberInt) : a.likes
  }));

  res.json(formatted);
});




      //Like / Unlike artwork
      app.post("/artworks/:id/like" ,verifyToken, async(req,res)=>{
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

     app.post ("/artworks/:id/favorite",verifyToken , async(req,res)=>{
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

     app.get("/my-favorites",verifyToken , async(req,res) =>{
         try{
            const  userId = req.user.uid;
         const favorites = await favoritesCollection.find({userId}).toArray();
         const artworkIds = favorites.map((fav)=> new ObjectId(fav.artworkId))
         const artworks = await  artworksCollection.find({_id: {$in: artworkIds}}).toArray()
         const formatted = artworks.map(a => ({
    ...a,
    _id: a._id.toString(),
    price: typeof a.price === "object" ? parseInt(a.price.$numberInt) : a.price,
    likes: typeof a.likes === "object" ? parseInt(a.likes.$numberInt) : a.likes
  }));
   res.json(formatted);
         }
          catch(err){
            res.status(500).send({ error: "Failed to fetch favorites" });
         }
     })

     app.delete("/my-favorites/:artworkId", verifyToken, async (req, res) => {
  try {
    const { artworkId } = req.params;
    const userId = req.user.uid;

   // console.log("Attempting to delete:", { artworkId, userId });
    const result = await favoritesCollection.deleteOne({artworkId:artworkId,userId:userId})
    console.log("Delete result:", result);
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Favorite not found" });
    }
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
})

     //search 
   //search 
app.get("/search", async (req, res) => {
  try {
    const search_text = req.query.search;
    const category = req.query.category;
    
    //  Case-insensitive visibility check
    let query = { visibility: { $regex: /^public$/i } };

    // Search by title or artist name
    if (search_text && search_text.trim()) {
      query.$or = [
        { title: { $regex: search_text, $options: "i" } },
        { artistName: { $regex: search_text, $options: "i" } },
      ];
    }

    // Filter by category 
    if (category && category.trim()) {
      query.category = { $regex: `^${category}$`, $options: "i" };
    }

    const result = await artworksCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).send({ error: "Failed to search artworks" });
  }
});
  
    app.get("/top-artists", async (req, res) => {
      const result = await artworksCollection
        .aggregate([
          { $match: { visibility: "Public" } },
          { $group: { _id: "$artistName", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ])
        .toArray();
      res.send(result);
    });
   
     


    
    app.put("/user",  async (req, res) => {
      const email = req.user.email;
      const data = req.body;
      const filter = { email };
      const update = { $set: data };
      const result = await usersCollection.updateOne(filter, update);
      res.send({ success: true, result });
    });

       

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

