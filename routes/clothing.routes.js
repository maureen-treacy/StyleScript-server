//Require Packages / Packages Functionalities

const router = require("express").Router();

const mongoose = require("mongoose");
// ********* require fileUploader in order to use it *********
const fileUploader = require("../config/cloudinary.config");

const { isAuthenticated } = require("../middleware/jwt.middleware");

// Require Data Models
const Clothing = require("../models/Clothing.model");
const Note = require("../models/Note.model");
const User = require("../models/User.model");
const Scheduler = require("../models/Scheduler.model");

//POST ROUTE that Creates a new Clothing
router.post("/clothing/create", isAuthenticated, async (req, res) => {
  const user = req.payload;
  const {
    title,
    image,
    type,
    size,
    color,
    brand,
    description,
    careInstructions,
    season,
  } = req.body;
  try {
    let newClothes = await Clothing.create({
      title,
      image,
      type,
      size,
      color,
      brand,
      description,
      careInstructions,
      season,
    });

    await User.findByIdAndUpdate(user._id, {
      $push: { userClothing: newClothes._id },
    });
    res.json(newClothes);
  } catch (error) {
    res.json(error);
  }
});

//GET ROUTE that gets all the Clothings

router.get("/clothing", isAuthenticated, async (req, res) => {
  const user = req.payload;
  try {
    let allClothings = await User.findById(user._id).populate("userClothing");
    res.json(allClothings);
  } catch (error) {
    res.json(error);
  }
});

router.post(
  "/upload",
  isAuthenticated,
  fileUploader.single("image"),
  async (req, res) => {
    const user = req.payload;
    try {
      if (!req.file) {
        throw new Error("No file uploaded!");
      }

      // Get the URL of the uploaded image and send it as a response.
      
      res.json({ image: req.file.path });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// GET Route that gets info of a specific Clothing
router.get("/clothing/:clothingId", async (req, res) => {
  const { clothingId } = req.params;
  try {
    let foundClothing = await Clothing.findById(clothingId).populate("note");
    res.json(foundClothing);
  } catch (error) {
    res.json(error);
  }
});

// HTTP Verbs: GET, POST, PUT, DELETE
// Since we're building a REST API, we're sending data via JSON and using HTTP REquests for communication

// PUT route to update info of a Clothing

router.put("/clothing/edit/:clothingId", async (req, res) => {
  const { clothingId } = req.params;
  const {
    title,
    image,
    type,
    size,
    color,
    brand,
    description,
    careInstructions,
    season,
  } = req.body;

  try {
    let updateClothing = await Clothing.findByIdAndUpdate(
      clothingId,
      {
        title,
        image,
        type,
        size,
        color,
        brand,
        description,
        careInstructions,
        season,
      },
      { new: true }
    );
    res.json(updateClothing);
  } catch (error) {
    res.json(error);
  }
});

// DELETE route to delete a Clothing
router.delete("/clothing/delete/:clothingId", async (req, res) => {
  const { clothingId } = req.params;

  try {
    await Clothing.findByIdAndDelete(clothingId);
    res.json({ message: "Clothing deleted" });
  } catch (error) {
    res.json(error);
  }
});

//create a note for a specific clothing
router.post("/note/create/:clothingId", isAuthenticated, async (req, res) => {
  const { clothingId } = req.params;
  const { content } = req.body;

  try {
    let newNote = await Note.create({ content, Clothing: clothingId });

    let response = await Clothing.findByIdAndUpdate(clothingId, {
      $push: { note: newNote._id },
    });

    res.json(response);
  } catch (error) {
    res.json(error);
  }
});

//Create a route to delete a note
router.delete(
  "/note/delete/:clothingId/:noteId",
  isAuthenticated,
  async (req, res) => {
    const { clothingId, noteId } = req.params;

    try {
      // Delete the note itself
      await Note.findByIdAndDelete(noteId);

      // Remove the note's reference from the clothing item
      await Clothing.findByIdAndUpdate(clothingId, { $pull: { note: noteId } });

      res.json({ message: "Note deleted" });
    } catch (error) {
      res.json(error);
    }
  }
);

//Create a route to update a note

router.put(
  "/note/update/:clothingId/:noteId",
  isAuthenticated,
  async (req, res) => {
    const { clothingId, noteId } = req.params;
    const { content } = req.body;

    try {
      // Update the note
      const updatedNote = await Note.findByIdAndUpdate(
        noteId,
        { content },
        { new: true }
      );

      res.json(updatedNote);
    } catch (error) {
      res.json(error);
    }
  }
);

// Add to Calendar
router.post(
  "/clothing/add-to-calendar/:id/",
  isAuthenticated,
  async (req, res) => {
    const user = req.payload;
    try {
      const clothingId = req.params.id;

      let clothing = await Clothing.findById(clothingId);
      let clothingTitle = clothing.title;

      let startDate = Date.now();
      let endDate = new Date().setUTCHours(22, 59, 59, 999);

      let allSchedules = await Scheduler.find();

      let id = allSchedules.length;

      // Push the clothingId to the user's laundry array
      let newScheduler = await Scheduler.create({
        title: clothingTitle,
        startDate,
        endDate,
        id,
      });

      // NEW : Push the schedulerId to the user's clothingCalendar array
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { calendarClothing: newScheduler._id },
      });

      // Send a response indicating success
      res.json({ message: "Added to calendar" });
    } catch (error) {
      console.error("Error adding to calendar:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post("/update-calendar", isAuthenticated, async (req, res) => {
  const calendarData = req.body.data;

  try {
    for (let i = 0; i < calendarData.length; i++) {
      let schedule = calendarData[i];
      await Scheduler.findByIdAndUpdate(schedule._id, { ...schedule });
    }
  } catch {}
});

//display calendar
router.get("/calendar-clothing", isAuthenticated, async (req, res) => {
  const user = req.payload;
  try {
    let myUser = await User.findById(user._id).populate("calendarClothing");
    res.json(myUser.calendarClothing);
  } catch (error) {
    console.error("Error getting calendar entries:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//delete from calendar
router.delete("/calendar-clothing/:schedulerId", isAuthenticated, async (req, res) => {
  const user = req.payload;
  const schedulerId = req.params.schedulerId;

  try {
    const myUser = await User.findById(user._id);

    // Check if the user has the calendarClothing entry with the specified ID
    if (!myUser.calendarClothing.includes(schedulerId)) {
      return res.status(404).json({ message: "Calendar entry not found" });
    }

    // Remove the entry from the user's calendarClothing array
    myUser.calendarClothing.pull(schedulerId);
    await myUser.save();

    res.json({ message: "Calendar entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting calendar entry:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// Add to Laundry
router.post(
  "/clothing/add-to-laundry/:id/",
  isAuthenticated,
  async (req, res) => {
    const user = req.payload;
    try {
      const clothingId = req.params.id;

      // Push the clothingId to the user's laundry array
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { laundry: clothingId },
      });

      // Send a response indicating success
      res.json({ message: "Added to laundry" });
    } catch (error) {
      console.error("Error adding to laundry:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

//display laundry list
router.get("/laundry", isAuthenticated, async (req, res) => {
  const user = req.payload;
  try {
    const laundry = await User.findById(user._id).populate("laundry");
    res.json(laundry);
  } catch (error) {
    console.error("Error getting laundry:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete all laundry for a specific user
router.delete('/remove-from-laundry/all', isAuthenticated, async (req, res) => {
  const user = req.payload;

  try {
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' }); // Updated the message
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $unset: { laundry: 1 } }, 
      { multi: true },
    );
    

    console.log("Laundry items deleted for user:", user._id);
    
    res.json({ message: 'All laundry deleted', user: updatedUser });
  } catch (error) {
    console.error('Error deleting all laundry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Remove from Laundry
router.delete("/remove-from-laundry/:id", isAuthenticated, async (req, res) => {
  const user = req.payload;
  try {
    const clothingId = req.params.id;
    const updatedUser = await User.findByIdAndUpdate(
      user._id, 
      { $pull: { laundry: clothingId } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" }); // Updated the message
    }
    res.json({ message: "Removed from laundry", user: updatedUser });
  } catch (error) {
    console.error("Error removing from laundry:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// Delete all packing for a specific user
router.delete('/remove-from-packing/all', isAuthenticated, async (req, res) => {
  const user = req.payload;

  try {
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' }); // Updated the message
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $unset: { packing: 1 } }, 
      { multi: true },
    );
    

    console.log("Packing items deleted for user:", user._id);
    
    res.json({ message: 'All packing deleted', user: updatedUser });
  } catch (error) {
    console.error('Error deleting all packing:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Add to Packing List
router.post(
  "/clothing/add-to-packing/:id/",
  isAuthenticated,
  async (req, res) => {
    const user = req.payload;
    try {
      const clothingId = req.params.id;

      // Push the clothingId to the user's laundry array
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { packing: clothingId },
      });

      // Send a response indicating success
      res.json({ message: "Added to packing list" });
    } catch (error) {
      console.error("Error adding to packing list:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// display packing list

router.get("/packing", isAuthenticated, async (req, res) => {
  const user = req.payload;
  try {
    const packing = await User.findById(user._id).populate("packing");
    res.json(packing);
  } catch (error) {
    console.error("Error getting packing list:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Remove from Packing List

router.delete("/remove-from-packing/:id", isAuthenticated, async (req, res) => {
  const user = req.payload;
  try {
    const clothingId = req.params.id;
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $pull: { packing: clothingId } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" }); // Updated the message
    }
    res.json({ message: "Removed from packing list", user: updatedUser });
  } catch (error) {
    console.error("Error removing from packing list:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Exporting Express Router with all its routes

module.exports = router;
