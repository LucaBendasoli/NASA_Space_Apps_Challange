"""Index locally archived SPHEREx Level 2 cutouts by sky footprint."""
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from threading import Lock
from time import monotonic
import logging
import math

from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS


@dataclass(frozen=True)
class Exposure:
    key: str
    path: Path
    utc: str
    detector: int
    center: tuple[float, float, float]
    min_dot: float


class EpochArchive:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.lock = Lock()
        self.entries = {}
        self.files = {}
        self.refresh_at = 0

    def refresh(self):
        with self.lock:
            if monotonic() < self.refresh_at:
                return
            files = {}
            for extension in ('*.fits', '*.fits.gz', '*.fit'):
                for path in self.directory.glob('*/cutouts/' + extension):
                    try:
                        stat = path.stat()
                        signature = (stat.st_size, stat.st_mtime_ns)
                        previous = self.files.get(path)
                        if previous and previous[0] == signature:
                            files[path] = previous
                            continue
                        entry = self.read_header(path, signature)
                        files[path] = (signature, entry)
                    except (OSError, ValueError, TypeError, KeyError, IndexError) as error:
                        logging.warning('FITS local ignorado (%s): %s', path.name, error)
            self.files = files
            self.entries = {entry.key: entry for _, entry in files.values()}
            self.refresh_at = monotonic() + 20

    def read_header(self, path, signature):
        header = fits.getheader(path, 'IMAGE')
        detector = int(str(header['DETECTOR']).lstrip('Dd'))
        width, height = header['NAXIS1'], header['NAXIS2']
        spatial = WCS(header).celestial
        center = spatial.pixel_to_world((width - 1) / 2, (height - 1) / 2).icrs
        corners = spatial.pixel_to_world([-.5, width-.5, width-.5, -.5],
                                         [-.5, -.5, height-.5, height-.5]).icrs
        radius = float(center.separation(corners).max().deg) * 1.05
        if not math.isfinite(radius):
            raise ValueError('WCS de cobertura inválido')
        mjd = header.get('MJD-OBS', header.get('MJD-BEG'))
        utc = (Time(float(mjd), format='mjd', scale='utc') if mjd is not None
               else Time(header.get('DATE-OBS', header.get('DATE-BEG')), scale='utc')).utc.iso
        identity = (path.relative_to(self.directory).as_posix(), *signature)
        key = sha256(repr(identity).encode()).hexdigest()[:32]
        lon, lat = center.ra.rad, center.dec.rad
        vector = (math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat))
        return Exposure(key, path, utc, detector, vector, math.cos(math.radians(radius)))

    def candidates(self, ra, dec, detector=None):
        self.refresh()
        lon, lat = math.radians(ra), math.radians(dec)
        x, y, z = math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat)
        entries = tuple(self.entries.values())
        return [entry for entry in entries if (detector is None or entry.detector == detector)
                and sum(a*b for a, b in zip(entry.center, (x, y, z))) >= entry.min_dot]

    def get(self, key):
        self.refresh()
        return self.entries.get(key)
