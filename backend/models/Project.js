
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: "",
    maxlength: 500
  },
  map: {
    type: [String],
    required: true,
    validate: {
      validator: value =>
        value.length === 100 &&
        value.every(cell =>
          ["empty", "road", "house", "business", "park", "school"]
            .includes(cell)
        ),
      message: "El mapa debe contener 100 celdas válidas"
    }
  }
}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);