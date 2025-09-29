from src.db.courses.activities import ActivityRead
from src.db.courses.courses import CourseRead


def structure_activity_content_by_type(activity):
    """Get Headings, Texts, Callouts, Answers and Paragraphs from the activity as a big list of strings (text only) and return it"""

    if "content" not in activity or not activity["content"]:
        # Return empty structure instead of empty list
        return [{"Headings": []}, {"Callouts": []}, {"Paragraphs": []}]

    content = activity["content"]

    headings = []
    callouts = []
    paragraphs = []

    for item in content:
        if item.get("content"):
            if (
                item["type"] == "heading"
                and len(item["content"]) > 0
                and "text" in item["content"][0]
            ):
                headings.append(item["content"][0]["text"])
            elif item["type"] in ["calloutInfo", "calloutWarning"] and all(
                "text" in text_item for text_item in item["content"]
            ):
                callouts.append(
                    "".join([text_item["text"] for text_item in item["content"]])
                )
            elif (
                item["type"] == "paragraph"
                and len(item["content"]) > 0
                and "text" in item["content"][0]
            ):
                paragraphs.append(item["content"][0]["text"])

    # TODO: Get Questions and Answers (if any)

    data_array = []

    # Add Headings
    data_array.append({"Headings": headings})

    # Add Callouts
    data_array.append({"Callouts": callouts})

    # Add Paragraphs
    data_array.append({"Paragraphs": paragraphs})

    return data_array


def serialize_activity_text_to_ai_comprehensible_text(
    data_array,
    course: CourseRead,
    activity: ActivityRead,
    isActivityEmpty: bool = False,
):
    # Check if activity is empty or data_array is empty/invalid
    if isActivityEmpty or not data_array or len(data_array) < 3:
        return (
            "Use this as a context "
            'This is a course about "'
            + course.name
            + '". '
            + 'This is a lecture about "'
            + activity.name
            + '". '
            + "There is no content yet in this lecture."
        )

    # Serialize Headings (safe access)
    serialized_headings = ""
    headings = data_array[0].get("Headings", [])
    for heading in headings:
        serialized_headings += heading + " "

    # Serialize Callouts (safe access)
    serialized_callouts = ""
    callouts = data_array[1].get("Callouts", [])
    for callout in callouts:
        serialized_callouts += callout + " "

    # Serialize Paragraphs (safe access)
    serialized_paragraphs = ""
    paragraphs = data_array[2].get("Paragraphs", [])
    for paragraph in paragraphs:
        serialized_paragraphs += paragraph + " "

    # Get a text that is comprehensible by the AI
    return (
        "Use this as a context "
        'This is a course about "'
        + course.name
        + '". '
        + 'This is a lecture about "'
        + activity.name
        + '". '
        'These are the headings: "'
        + serialized_headings
        + '" These are the callouts: "'
        + serialized_callouts
        + '" These are the paragraphs: "'
        + serialized_paragraphs
        + '"'
    )
