function buildOrderItems(cartItems) {
  return cartItems.map((item) => ({
    course: item.course._id,
    price: item.course.price || 0,
  }));
}

module.exports = { buildOrderItems };
