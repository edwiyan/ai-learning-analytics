FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x backend/entrypoint.sh

CMD ["bash", "backend/entrypoint.sh"]
