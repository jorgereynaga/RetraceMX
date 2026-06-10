from __future__ import annotations

import re
import time
from dataclasses import dataclass
from decimal import Decimal
from decimal import InvalidOperation
from typing import Protocol


@dataclass
class ScaleReadingPayload:
    device_identifier: str
    weight_kg: Decimal
    is_stable: bool
    is_manual: bool
    disconnected: bool = False
    raw_value: str = ""


class ScaleAdapter(Protocol):
    def read(self) -> ScaleReadingPayload: ...


class ThermalPrinterAdapter(Protocol):
    def print_ticket(self, payload: dict) -> dict: ...


@dataclass
class SerialScaleAdapter:
    device_identifier: str
    port: str
    kind: str = "vehicle_scale"
    baudrate: int = 9600
    bytesize: int = 8
    parity: str = "N"
    stopbits: float = 1
    timeout: float = 1.5
    encoding: str = "utf-8"
    query: str = ""

    @staticmethod
    def _format_query(query: str) -> bytes:
        command = query.strip()
        if not command:
            return b""
        if "\r" in command or "\n" in command:
            return command.encode("utf-8", errors="ignore")
        return f"\n{command}\r".encode("utf-8", errors="ignore")

    @staticmethod
    def _read_frame(connection, encoding: str) -> str:
        reader = getattr(connection, "read_until", None)
        raw = reader(b"\r") if callable(reader) else connection.readline()
        if not raw:
            return ""
        text = raw.decode(encoding, errors="replace").strip("\r\n\0 ")
        return text

    def _open_serial(self):
        try:
            import serial
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise RuntimeError("pyserial no esta instalado en el backend.") from exc

        parity_map = {
            "N": serial.PARITY_NONE,
            "E": serial.PARITY_EVEN,
            "O": serial.PARITY_ODD,
            "M": serial.PARITY_MARK,
            "S": serial.PARITY_SPACE,
        }
        bytesize_map = {
            5: serial.FIVEBITS,
            6: serial.SIXBITS,
            7: serial.SEVENBITS,
            8: serial.EIGHTBITS,
        }
        stopbits_map = {
            1: serial.STOPBITS_ONE,
            1.5: serial.STOPBITS_ONE_POINT_FIVE,
            2: serial.STOPBITS_TWO,
        }

        connection_kwargs = {
            "port": self.port,
            "baudrate": self.baudrate,
            "bytesize": bytesize_map.get(int(self.bytesize), serial.EIGHTBITS),
            "parity": parity_map.get(str(self.parity).upper(), serial.PARITY_NONE),
            "stopbits": stopbits_map.get(float(self.stopbits), serial.STOPBITS_ONE),
            "timeout": self.timeout,
        }
        return serial, connection_kwargs

    def read(self) -> ScaleReadingPayload:
        serial, connection_kwargs = self._open_serial()

        try:
            with serial.Serial(**connection_kwargs) as connection:
                connection.reset_input_buffer()
                connection.reset_output_buffer()
                query_bytes = self._format_query(self.query)
                if query_bytes:
                    connection.write(query_bytes)
                    connection.flush()

                deadline = time.monotonic() + max(float(self.timeout), 0.5)
                last_text = ""
                while time.monotonic() < deadline:
                    text = self._read_frame(connection, self.encoding)
                    if not text:
                        continue
                    last_text = text
                    parsed = self._parse_line(text)
                    if parsed is None:
                        continue
                    weight_kg, is_stable = parsed
                    return ScaleReadingPayload(
                        device_identifier=self.device_identifier,
                        weight_kg=weight_kg,
                        is_stable=is_stable,
                        is_manual=False,
                        disconnected=False,
                        raw_value=text,
                    )

                if last_text:
                    parsed = self._parse_line(last_text)
                    if parsed is not None:
                        weight_kg, is_stable = parsed
                        return ScaleReadingPayload(
                            device_identifier=self.device_identifier,
                            weight_kg=weight_kg,
                            is_stable=is_stable,
                            is_manual=False,
                            disconnected=False,
                            raw_value=last_text,
                        )
        except (OSError, serial.SerialException) as exc:
            raise RuntimeError(
                f"No se pudo abrir el puerto {self.port} para la bascula. "
                "Verifica que el adaptador este en ese COM y que ningun otro programa lo este usando."
            ) from exc

        if last_text:
            raise RuntimeError(
                f"No se pudo interpretar una lectura valida desde {self.port}. "
                f"Ultima linea recibida: {last_text!r}. "
                "Revisa baudrate, paridad, bytesize, stopbits y query."
            )
        raise RuntimeError(
            f"No se recibio ninguna lectura desde {self.port}. "
            "Revisa baudrate, timeout y query, y confirma que la bascula este enviando datos."
        )

    def probe(self, max_lines: int = 5) -> dict:
        serial, connection_kwargs = self._open_serial()
        try:
            with serial.Serial(**connection_kwargs) as connection:
                connection.reset_input_buffer()
                connection.reset_output_buffer()
                query_bytes = self._format_query(self.query)
                if query_bytes:
                    connection.write(query_bytes)
                    connection.flush()

                deadline = time.monotonic() + max(float(self.timeout), 0.5)
                lines: list[dict[str, str]] = []
                while time.monotonic() < deadline and len(lines) < max_lines:
                    reader = getattr(connection, "read_until", None)
                    raw = reader(b"\r") if callable(reader) else connection.readline()
                    if not raw:
                        continue
                    text = raw.decode(self.encoding, errors="replace").strip("\r\n\0 ")
                    if not text:
                        continue
                    lines.append(
                        {
                            "text": text,
                            "hex": raw.hex(),
                        }
                    )
                return {
                    "port": self.port,
                    "baudrate": self.baudrate,
                    "bytesize": self.bytesize,
                    "parity": self.parity,
                    "stopbits": self.stopbits,
                    "timeout": self.timeout,
                    "query": self.query,
                    "line_count": len(lines),
                    "lines": lines,
                }
        except (OSError, serial.SerialException) as exc:
            raise RuntimeError(
                f"No se pudo abrir el puerto {self.port} para la bascula. "
                "Verifica que el adaptador este en ese COM y que ningun otro programa lo este usando."
            ) from exc

    @staticmethod
    def _parse_line(line: str) -> tuple[Decimal, bool] | None:
        matches = re.findall(r"[-+]?\d+(?:[.,]\d+)?", line)
        if not matches:
            return None
        candidate = matches[-1].replace(",", ".")
        try:
            weight_kg = Decimal(candidate)
        except InvalidOperation:
            return None
        normalized = line.lower()
        if re.search(r"\b(inestable|unstable|fluc|moving|mov)\b", normalized):
            is_stable = False
        elif re.search(r"\b(estable|stable|st)\b", normalized):
            is_stable = True
        else:
            is_stable = True
        return weight_kg, is_stable

