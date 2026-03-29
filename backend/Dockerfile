FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.prod.txt alembic.ini ./
RUN pip install --no-cache-dir -r requirements.prod.txt

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["./entrypoint.sh"]
