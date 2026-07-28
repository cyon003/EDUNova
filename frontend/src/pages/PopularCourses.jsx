import availableCourses from "../data/courses";
import Courses from "./Courses";

const topTenCourses = [...availableCourses]
  .sort(
    (a, b) =>
      Number(b.rating) - Number(a.rating) ||
      a.name.localeCompare(b.name),
  )
  .slice(0, 10);

function PopularCourses() {
  return <Courses courseItems={topTenCourses} title="Popular Courses" />;
}

export default PopularCourses;
