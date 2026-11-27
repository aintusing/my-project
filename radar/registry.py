"""Реестр источников. Правится в sources.json без изменения кода."""
import json
import pathlib

PATH = pathlib.Path(__file__).with_name("sources.json")


def load():
    return json.loads(PATH.read_text(encoding="utf-8"))
