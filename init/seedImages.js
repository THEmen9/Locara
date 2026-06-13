const mongoose = require("mongoose");
const Listing = require("../models/listing");

mongoose.connect("mongodb://127.0.0.1:27017/staynest");

const imagePool = [
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80"
];

function randomImages(count = 5) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const url = imagePool[Math.floor(Math.random() * imagePool.length)];
    arr.push({
      url: url,
      filename: "demo-image"
    });
  }
  return arr;
}

async function seedImages() {
  const listings = await Listing.find();

  for (let listing of listings) {
    listing.images = randomImages(5); // 5 images per listing
    await listing.save();
  }

  console.log("Images seeded successfully ✅");
  mongoose.connection.close();
}

seedImages();