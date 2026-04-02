"""
Gecentraliseerde logging voor VrijStaan.
Schrijft naar logs/vrijstaan.log met rotatie en retentie.
"""
import os
from loguru import logger

# Zorg dat de logs/ map bestaat
os.makedirs("logs", exist_ok=True)

# Verwijder de standaard stderr sink
logger.remove()

# Bestand sink: roterend, 7 dagen bewaren
logger.add(
    "logs/vrijstaan.log",
    rotation="1 day",
    retention="7 days",
    compression="zip",
    level="INFO",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} | {message}",
    encoding="utf-8",
)

# Console sink: alleen WARNING en hoger (niet spammen in Streamlit terminal)
logger.add(
    lambda msg: print(msg, end=""),
    level="WARNING",
    format="{time:HH:mm:ss} | {level} | {message}",
    colorize=True,
)

__all__ = ["logger"]
