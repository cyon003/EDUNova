export const COURSE_RELOAD_MESSAGE = "We couldn’t load this course’s purchase details. Please refresh the page and try again.";

export function purchaseCourseId(course) {
  if (typeof course?._id !== "string" || !/^[a-f\d]{24}$/i.test(course._id)) throw new Error(COURSE_RELOAD_MESSAGE);
  return course._id;
}

export function purchaseErrorMessage(message, fallback = "Unable to complete your request. Please try again.") {
  if (/provide valid course ids|courseId is required|invalid course id|cast to objectid/i.test(message || "")) return COURSE_RELOAD_MESSAGE;
  return message || fallback;
}
