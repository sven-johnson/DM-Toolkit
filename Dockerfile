FROM python:3.13-slim

WORKDIR /app

# Copied separately from the rest of the source so this layer's cache key is
# based solely on requirements.txt's content — a dependency change always
# busts this layer, regardless of what else changes in the repo.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY start.sh ./
COPY backend ./backend

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["bash", "start.sh"]
