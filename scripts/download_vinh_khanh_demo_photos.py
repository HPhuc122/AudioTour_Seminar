"""Build the local HCMC demo photo set from freely licensed Commons files.

Each POI gets a unique photograph of its named venue as Highlight and at least
one food/drink photograph as Menu. Venue/menu details are demo records and
should be checked before any public launch.
"""

from __future__ import annotations

import csv
import html
import json
import re
import time
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "vinh-khanh-demo"
IMAGE_DIR = DATA / "images"
DATASET = DATA / "source.vi.json"
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "AudioTourDemoDataset/1.0 (licensed photo import)"

# The photo subject and restaurant are named from the Commons description.
# Food/drink photos that are not expressly from the named venue are labelled as
# representative menu examples in image-rights.csv.
VENUES = {
    "VK-ALO-333": {
        "name": "Dim Tu Tac – 55 Đông Du",
        "address": "55 Đông Du, phường Sài Gòn, Thành phố Hồ Chí Minh",
        "category": "Ẩm thực Quảng Đông",
        "shortDescription": "Nhà hàng Quảng Đông với dim sum và vịt quay.",
        "narration": "Dim Tu Tac tại 55 Đông Du là nhà hàng Quảng Đông ở trung tâm thành phố. Ảnh menu minh họa món vịt quay được chụp tại hệ thống Dim Tu Tac.",
        "latitude": 10.775722,
        "longitude": 106.704217,
        "cover": ("Dim Tu Tac flagship location, 55 Đông Du Street.jpg", "dim-tu-tac-storefront.jpg"),
        "menu": ("Dim Tu Tac finished servings of Peking duck.jpg", "dim-tu-tac-peking-duck.jpg", True),
    },
    "VK-OC-DAO-232-123": {
        "name": "Ốc La Cà – Đồng Đen",
        "address": "248A Đồng Đen, phường Tân Bình, Thành phố Hồ Chí Minh",
        "category": "Ốc và hải sản",
        "shortDescription": "Quán ốc và hải sản trên đường Đồng Đen.",
        "narration": "Ốc La Cà ở Đồng Đen là điểm ăn ốc tại khu vực Tân Bình. Ảnh bìa và ảnh món đều được ghi nhận tại quán.",
        "latitude": 10.790000,
        "longitude": 106.641900,
        "cover": ("Quán ốc La Cà - Đồng Đen, Tân Bình, snH 201 (1).JPG", "oc-la-ca-storefront.jpg"),
        "menu": ("Quán ốc La Cà - Đồng Đen, Tân Bình, snH 201 (2).JPG", "oc-la-ca-menu.jpg", True),
    },
    "VK-BUN-CA-DI-TU-75": {
        "name": "Ốc Hai Lùn – Lê Đại Hành",
        "address": "Đường Lê Đại Hành, phường Hòa Bình, Thành phố Hồ Chí Minh",
        "category": "Ốc và hải sản",
        "shortDescription": "Quán ốc lâu năm trên đường Lê Đại Hành.",
        "narration": "Ốc Hai Lùn trên đường Lê Đại Hành phục vụ các món ốc và hải sản. Bộ ảnh tư liệu được chụp tại quán; địa chỉ số nhà cần xác nhận lại.",
        "latitude": 10.763000,
        "longitude": 106.649500,
        "cover": ("Quán ốc Hai Lùn-Lê Đại Hành, Quận 11- sn 2012 (1).JPG", "oc-hai-lun-storefront.jpg"),
        "menu": ("Quán ốc Hai Lùn-Lê Đại Hành, Quận 11- sn 2012 (2).JPG", "oc-hai-lun-menu.jpg", True),
    },
    "VK-BUN-THIT-NUONG-CO-NGA-14": {
        "name": "Hum Lounge · 34 Võ Văn Tần",
        "address": "34 Võ Văn Tần, phường Xuân Hòa, Thành phố Hồ Chí Minh",
        "category": "Ẩm thực thực vật",
        "shortDescription": "Nhà hàng thực vật trong không gian kiến trúc xanh.",
        "narration": "Hum Lounge là nhà hàng thực vật tại 34 Võ Văn Tần. Ảnh món ăn kèm là ảnh ẩm thực chay tại Thành phố Hồ Chí Minh, dùng minh họa và không xác nhận là món trong thực đơn Hum.",
        "latitude": 10.778481,
        "longitude": 106.692128,
        "cover": ("Man Moi Thao Dien.jpg", "hum-lounge-storefront.jpg"),
        "menu": ("Saigon Vegetarian food.jpg", "hum-lounge-menu-sample.jpg", False),
    },
    "VK-OC-VU-37": {
        "name": "Cơm Tấm Cali – Hoàng Diệu",
        "address": "235 Hoàng Diệu, phường Khánh Hội, Thành phố Hồ Chí Minh",
        "category": "Cơm tấm",
        "shortDescription": "Cơm tấm và món ăn Việt tại chi nhánh Quận 4.",
        "narration": "Ảnh bìa ghi lại không gian Cơm Tấm Cali tại Quận 4; ảnh menu là món bún thịt nướng chụp tại chi nhánh Hoàng Diệu.",
        "latitude": 10.758500,
        "longitude": 106.704700,
        "cover": ("Nội thất quán cơm tấm Cali Quận 4 (2).jpg", "com-tam-cali-q4-storefront.jpg"),
        "menu": ("Bún thịt nướng tại quán Cơm tấm Cali ở Quận 4, đường Hoàng Diệu (1).jpg", "com-tam-cali-q4-menu.jpg", True),
    },
    "VK-LANG-531": {
        "name": "Quán bánh xèo Đinh Công Tráng",
        "address": "Đường Đinh Công Tráng, phường Tân Định, Thành phố Hồ Chí Minh",
        "category": "Bánh xèo",
        "shortDescription": "Quán bánh xèo trên đường Đinh Công Tráng.",
        "narration": "Ảnh bìa được chụp tại một nhà hàng bánh xèo trên đường Đinh Công Tráng. Ảnh menu là ảnh minh họa món bánh xèo, chưa xác nhận là món của đúng quán trong ảnh bìa.",
        "latitude": 10.789550,
        "longitude": 106.691344,
        "cover": ("Banh xeo restaurant on Dinh Cong Trang Street (49355818807).jpg", "banh-xeo-dinh-cong-trang-storefront.jpg"),
        "menu": ("Bánh xèo with pork sausage and shrimp served with various garnishes.jpg", "banh-xeo-menu.jpg", False),
    },
    "VK-OT-XIEM-568": {
        "name": "Bún Bò 1980 – Tân Phú",
        "address": "Đường Nguyễn Sơn, phường Tân Phú, Thành phố Hồ Chí Minh",
        "category": "Bún bò Huế",
        "shortDescription": "Quán bún bò Huế tại khu vực Tân Phú.",
        "narration": "Ảnh bìa ghi lại một quán bún bò 1980 tại Tân Phú. Ảnh menu là tô bún bò Huế chụp tại một quán ăn ở Thành phố Hồ Chí Minh.",
        "latitude": 10.798300,
        "longitude": 106.635000,
        "cover": ("Quán bún bò 1980 trên đường NS tại Tân Phú, ng11th5n2021 (Cửa sổ kiểu Pháp) (1).jpg", "bun-bo-1980-storefront.jpg"),
        "menu": ("Saigon Bun bo hue.jpg", "bun-bo-hue-menu.jpg", False),
    },
    "VK-A-FAT-668": {
        "name": "Chiang Rai – Nhà hàng Thái",
        "address": "710/5 Lũy Bán Bích, phường Tân Phú, Thành phố Hồ Chí Minh",
        "category": "Ẩm thực Thái",
        "shortDescription": "Nhà hàng Thái tại khu vực Tân Phú.",
        "narration": "Ảnh bìa ghi lại nhà hàng Thái tại Tân Phú. Ảnh menu minh họa món lẩu phù hợp với nhóm món nóng của nhà hàng.",
        "latitude": 10.782800,
        "longitude": 106.626800,
        "cover": ("Nhà hàng Thái tại Tân Phú, tháng 12 năm 2021 (1).jpg", "chiang-rai-storefront.jpg"),
        "menu": ("Hotpot 1212-0701.jpg", "chiang-rai-hotpot-menu.jpg", False),
    },
    "VK-SUON-MUOI-OT-712": {
        "name": "Anan Saigon",
        "address": "89 Tôn Thất Đạm, phường Sài Gòn, Thành phố Hồ Chí Minh",
        "category": "Ẩm thực Việt Nam",
        "shortDescription": "Nhà hàng Việt Nam trong khu chợ cũ Tôn Thất Đạm.",
        "narration": "Anan Saigon nằm tại 89 Tôn Thất Đạm. Ảnh món trong bộ demo là ảnh gà kho nước dừa tại một quán ăn ở Thành phố Hồ Chí Minh, không khẳng định đây là món hiện có của Anan.",
        "latitude": 10.768600,
        "longitude": 106.703600,
        "cover": ("Anan Saigon.jpg", "anan-saigon-storefront.jpg"),
        "menu": ("Saigon Chicken in spicy sweet sauce.jpg", "anan-saigon-menu-sample.jpg", False),
    },
    "VK-CHILLI-232-105": {
        "name": "Maison Marou – Quận 1",
        "address": "Khu vực Calmette, phường Bến Thành, Thành phố Hồ Chí Minh",
        "category": "Cà phê và sô-cô-la",
        "shortDescription": "Cửa hàng cà phê và sô-cô-la Marou tại Quận 1.",
        "narration": "Ảnh bìa là cửa hàng Maison Marou ở Quận 1. Ảnh menu là bánh sô-cô-la minh họa, không khẳng định là sản phẩm hiện có tại cửa hàng.",
        "latitude": 10.769536,
        "longitude": 106.698006,
        "cover": ("Maison Marou Ho Chi Minh City.jpg", "maison-marou-storefront.jpg"),
        "menu": ("Chocolatecake.jpg", "maison-marou-menu-sample.jpg", False),
    },
    "VK-THAO-OC-383": {
        "name": "Café City Garden – Tân Bình",
        "address": "Café City Garden, phường Tân Bình, Thành phố Hồ Chí Minh",
        "category": "Cà phê",
        "shortDescription": "Quán cà phê City Garden tại Tân Bình.",
        "narration": "Ảnh bìa và ảnh cà phê được chụp tại Café City Garden ở Tân Bình.",
        "latitude": 10.800000,
        "longitude": 106.650000,
        "cover": ("Cafe City Garden Tân Bình ngày 31 tháng 12 năm 2018 (1).jpg", "city-garden-storefront.jpg"),
        "menu": ("Ly cà phê và trà đá tại quán City Garden năm 2019 (3).jpg", "city-garden-coffee-menu.jpg", True),
    },
    "VK-OC-OANH-534": {
        "name": "Café 30/4 – Nam Kỳ Khởi Nghĩa",
        "address": "135 Nam Kỳ Khởi Nghĩa, phường Sài Gòn, Thành phố Hồ Chí Minh",
        "category": "Cà phê",
        "shortDescription": "Quán cà phê trên đường Nam Kỳ Khởi Nghĩa.",
        "narration": "Ảnh bìa ghi lại Café 30/4 tại số 135 Nam Kỳ Khởi Nghĩa. Ảnh menu minh họa cà phê và bánh mì tại Sài Gòn.",
        "latitude": 10.778606,
        "longitude": 106.696094,
        "cover": ("2023-12-10 Café 30／4, Nam Kỳ Khởi Nghĩa Street, Ho Chi Minh City.jpg", "cafe-30-4-storefront.jpg"),
        "menu": ("2023-12-10 Coffee and bánh mì in Saigon.jpg", "cafe-30-4-menu-sample.jpg", False),
    },
}


def commons_metadata(titles: list[str]) -> dict[str, dict]:
    params = urlencode({
        "action": "query",
        "format": "json",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": "1280",
        "titles": "|".join(f"File:{title}" for title in titles),
    })
    request = Request(f"{API}?{params}", headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:
        pages = json.loads(response.read().decode("utf-8"))["query"]["pages"].values()
    result = {}
    for page in pages:
        if page.get("missing") is not None or not page.get("imageinfo"):
            raise RuntimeError(f"Wikimedia source was not found: {page.get('title')}")
        result[page["title"].removeprefix("File:")] = page["imageinfo"][0]
    if len(result) != len(set(titles)):
        raise RuntimeError("Wikimedia did not return metadata for every requested image")
    return result


def plain(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def download(photo: dict, destination: Path) -> None:
    request = Request(photo["thumburl"], headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:
        content_type = response.headers.get_content_type()
        content = response.read()
    if content_type != "image/jpeg" or len(content) < 10_000:
        raise RuntimeError(f"Invalid image download for {destination.name}: {content_type}, {len(content)} bytes")
    destination.write_bytes(content)


def main() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    dataset = json.loads(DATASET.read_text(encoding="utf-8-sig"))
    if {poi["code"] for poi in dataset["poi"]} != set(VENUES):
        raise RuntimeError("Venue map must cover the current POI codes exactly")

    requested = []
    for venue in VENUES.values():
        requested.extend([venue["cover"][0], venue["menu"][0]])
    metadata = commons_metadata(requested)
    rights_rows = []

    for poi in dataset["poi"]:
        venue = VENUES[poi["code"]]
        for role, spec in (("Highlight", venue["cover"]), ("Menu", venue["menu"])):
            source_title, output_name = spec[:2]
            info = metadata[source_title]
            output = IMAGE_DIR / output_name
            download(info, output)
            ext = info.get("extmetadata", {})
            author = plain(ext.get("Artist", {}).get("value", "Unknown author")) or "Unknown author"
            credit = plain(ext.get("Credit", {}).get("value", ""))
            license_name = plain(ext.get("LicenseShortName", {}).get("value", "Unspecified")) or "Unspecified"
            license_url = plain(ext.get("LicenseUrl", {}).get("value", ""))
            source_url = f"https://commons.wikimedia.org/wiki/File:{quote(source_title.replace(' ', '_'), safe='()_.,-')}"
            is_same_venue = bool(spec[2]) if len(spec) > 2 else role == "Highlight"
            note = (
                "Photo of the named venue; Wikimedia thumbnail resized to 1280px."
                if role == "Highlight"
                else (
                    "Menu photo documented at the named venue; Wikimedia thumbnail resized to 1280px."
                    if is_same_venue
                    else "Representative menu photo; real licensed dish/drink photo, not verified as a current item at this venue."
                )
            )
            rights_rows.append({
                "poi_code": poi["code"],
                "asset_file": f"images/{output_name}",
                "role": role,
                "source_page": source_url,
                "author": author,
                "license": license_name,
                "license_url": license_url or source_url,
                "attribution": f"{author} — {source_title} — {license_name}",
                "status": "downloaded_licensed_venue_or_menu_photo",
                "notes": note + (f" Credit: {credit}." if credit else ""),
            })
            time.sleep(0.25)

        for field in ("name", "address", "category", "shortDescription", "narration", "latitude", "longitude"):
            poi[field] = venue[field]
        poi["sourceUrl"] = rights_rows[-2]["source_page"]
        poi["coordinateStatus"] = "approximate_demo_coordinate; verify before public launch"
        poi.pop("coordinateSourceOsmId", None)
        poi["imageStatus"] = "real_venue_and_menu_photos"
        poi["imageFiles"] = [f"images/{venue['cover'][1]}", f"images/{venue['menu'][1]}"]

    dataset["dataset"] = "ho-chi-minh-food-photo-demo"
    dataset["area"] = {
        "name": "Các địa điểm ẩm thực có ảnh thật tại Thành phố Hồ Chí Minh",
        "administrativeArea": "Thành phố Hồ Chí Minh",
        "sourceUrl": "https://commons.wikimedia.org/wiki/Category:Restaurants_in_Ho_Chi_Minh_City",
    }
    dataset["tours"] = [
        {
            "code": "VK-TOUR-QUANH-PHO",
            "name": "Ẩm thực trung tâm Sài Gòn",
            "description": "Các điểm ăn uống tại trung tâm, từ nhà hàng Quảng Đông đến món Việt và cà phê.",
            "estimatedMinutes": 100,
            "transportMode": "walking",
            "poiCodes": ["VK-ALO-333", "VK-SUON-MUOI-OT-712", "VK-CHILLI-232-105", "VK-OC-OANH-534"],
        },
        {
            "code": "VK-TOUR-OC-HAI-SAN",
            "name": "Ốc, hải sản và món chay",
            "description": "Các quán ốc và hải sản kết hợp với trải nghiệm ẩm thực thực vật tại Hum Lounge.",
            "estimatedMinutes": 150,
            "transportMode": "driving",
            "poiCodes": ["VK-OC-DAO-232-123", "VK-BUN-CA-DI-TU-75", "VK-BUN-THIT-NUONG-CO-NGA-14", "VK-THAO-OC-383"],
        },
        {
            "code": "VK-TOUR-LAU-NUONG",
            "name": "Món Việt và món nóng",
            "description": "Cơm tấm, bánh xèo, bún bò và lẩu Thái ở các khu vực trong thành phố.",
            "estimatedMinutes": 120,
            "transportMode": "driving",
            "poiCodes": ["VK-OC-VU-37", "VK-LANG-531", "VK-OT-XIEM-568", "VK-A-FAT-668"],
        },
    ]
    DATASET.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    fields = ["poi_code", "asset_file", "role", "source_page", "author", "license", "license_url", "attribution", "status", "notes"]
    with (DATA / "image-rights.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rights_rows)

    print(f"Downloaded {len(rights_rows)} unique venue/menu photos for {len(dataset['poi'])} POIs.")


if __name__ == "__main__":
    main()
