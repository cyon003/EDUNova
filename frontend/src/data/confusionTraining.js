const confusionTraining = {
  mathematics: {
    "Introduction to Algebra": {
      concepts: ["variable", "expression", "coefficient", "constant"],
      misconceptions: [
        { patterns: ["variable is always", "variable cannot change"], feedback: "A variable represents a value that can change or be unknown; it is not always one fixed number." },
        { patterns: ["expression has an equals", "expression is an equation"], feedback: "An expression contains values and operations. An equation specifically states that two expressions are equal." },
      ],
      question: "How is an expression different from an equation? Give one example of each.",
    },
    "Understanding Equations": {
      concepts: ["equation", "equal", "inverse operation", "solution"],
      misconceptions: [
        { patterns: ["change one side", "only one side"], feedback: "To preserve equality, any operation performed on one side must also be performed on the other side." },
        { patterns: ["solution is the answer after equals"], feedback: "A solution is a value that makes the entire equation true when substituted for the variable." },
      ],
      question: "Why must the same operation be applied to both sides of an equation?",
    },
    "Geometry Fundamentals": {
      concepts: ["angle", "area", "perimeter", "shape"],
      misconceptions: [
        { patterns: ["area is around", "perimeter is inside"], feedback: "Perimeter measures the distance around a shape, while area measures the space inside it." },
        { patterns: ["all angles are equal"], feedback: "Angles are only equal when the properties of the specific shape or diagram prove that they are equal." },
      ],
      question: "When would you calculate perimeter instead of area in a real situation?",
    },
  },
};

export default confusionTraining;
