import cv2
import numpy as np
import base64
import logging

logger = logging.getLogger(__name__)


def divide_image_with_adaptive_threshold_base64(image_base64, rows, cols, overlap=50):
    logger.debug("Decoding and analyzing the image...")
    image_data = base64.b64decode(image_base64)
    np_image = np.frombuffer(image_data, dtype=np.uint8)
    image = cv2.imdecode(np_image, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Invalid base64 image data provided.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask = np.zeros_like(gray)
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        cv2.rectangle(mask, (x, y), (x + w, y + h), 255, -1)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (overlap, overlap))
    dilated = cv2.dilate(mask, kernel, iterations=1)

    h, w = image.shape[:2]
    step_h = h // rows
    step_w = w // cols

    sections = []
    section_coordinates = []
    for r in range(rows):
        for c in range(cols):
            y1 = max(r * step_h - overlap, 0)
            y2 = min((r + 1) * step_h + overlap, h)
            x1 = max(c * step_w - overlap, 0)
            x2 = min((c + 1) * step_w + overlap, w)

            if np.any(dilated[y1:y2, x1:x2]):
                y1 = max(0, y1 - overlap)
                y2 = min(h, y2 + overlap)
                x1 = max(0, x1 - overlap)
                x2 = min(w, x2 + overlap)

            section = image[y1:y2, x1:x2]
            sections.append(section)
            section_coordinates.append((x1, y1, x2, y2))

    logger.debug("Image successfully divided using adaptive thresholding.")
    return sections, section_coordinates


def encode_image_to_base64(image):
    logger.debug("Encoding image to base64.")
    _, buffer = cv2.imencode(".jpg", image)
    return base64.b64encode(buffer).decode("utf-8")
