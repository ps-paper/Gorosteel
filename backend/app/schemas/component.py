from pydantic import BaseModel


class Grade(BaseModel):
    value: float
    meaning: str


class Component(BaseModel):
    key: str
    name: str
    label_column: str
    unit: str
    grades: list[Grade]  # 정상 → 고장 직전 순서
