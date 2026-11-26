// Koordinat default area layanan (Area Serang / Banten)
const DEFAULT_LAT = -6.118500;
const DEFAULT_LNG = 106.183500;

// Elemen DOM
const formEl = document.getElementById("registration-form");
const namaInput = document.getElementById("nama");
const noHpInput = document.getElementById("no_hp");
const koordinatInput = document.getElementById("koordinat");
const koordinatText = document.getElementById("koordinat-text");
const linkBukaGmaps = document.getElementById("link-buka-gmaps");
const alamatTextarea = document.getElementById("alamat");
const detailAlamatInput = document.getElementById("detail_alamat");
const paketSelect = document.getElementById("paket");
const btnLokasi = document.getElementById("btn-lokasi");

let isProgrammaticEdit = false;
let typingTimer = null;
let searchSeq = 0;

// =========================================================================
// VALIDASI NOMOR HP INDONESIA (12 DIGIT) & NAMA LENGKAP (TIDAK ACAK)
// =========================================================================

// Paksa input No. HP hanya angka dan maksimal 12 digit
noHpInput.addEventListener("input", function () {
    let digits = this.value.replace(/\D/g, "");

    // Jika user mengetik awalan 628..., ubah ke 08... lalu batasi 12 digit
    if (digits.startsWith("628")) {
        digits = "0" + digits.slice(2);
    }

    this.value = digits.slice(0, 12);
    this.setCustomValidity("");
});

// Bersihkan pesan error saat user memperbaiki nama
namaInput.addEventListener("input", function () {
    this.setCustomValidity("");
});

function validasiNomorHpIndo(nilai) {
    const bersih = (nilai || "").replace(/\D/g, "");
    if (!/^08\d{10}$/.test(bersih)) {
        return "Nomor HP Indonesia harus 12 digit, angka saja, dan diawali 08 (contoh: 081234567890).";
    }
    return "";
}

function validasiNamaLengkap(nilai) {
    const nama = (nilai || "").trim().replace(/\s+/g, " ");

    if (nama.length < 3) {
        return "Nama lengkap minimal 3 karakter.";
    }

    // Hanya boleh huruf alfabet, spasi, titik, atau apostrof
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'.]+$/.test(nama)) {
        return "Nama lengkap hanya boleh berisi huruf, tanpa angka atau simbol acak.";
    }

    // Tolak karakter yang berulang 3x atau lebih (misal: "aaaa", "zzz")
    if (/(.)\1{2,}/i.test(nama)) {
        return "Masukkan nama asli yang wajar, bukan huruf berulang atau acak.";
    }

    // Tolak pola keyboard acak umum
    const polaAcak = /^(qwerty|asdf|zxcv|poiuy|lkjhg|mnbvc|test|admin|user|abcd|1234)+$/i;
    const kompak = nama.replace(/[^A-Za-z]/g, "");
    if (polaAcak.test(kompak) || kompak.length < 3) {
        return "Nama terlihat tidak wajar atau acak. Harap isi nama lengkap sesuai KTP.";
    }

    // Setiap kata minimal 2 huruf dan memiliki huruf vokal agar tidak seperti singkatan/acak
    const kataList = nama.split(" ").filter(Boolean);
    const semuaKataWajar = kataList.every((kata) => {
        const hurufSaja = kata.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
        return hurufSaja.length >= 2 && /[AEIOUaeiou]/.test(hurufSaja);
    });

    if (!semuaKataWajar) {
        return "Harap masukkan nama lengkap yang jelas (bukan huruf acak atau singkatan tidak wajar).";
    }

    return "";
}

// =========================================================================
// PETA CITRA SATELIT & SINKRONISASI ALAMAT OTOMATIS
// =========================================================================

const map = L.map("map").setView([DEFAULT_LAT, DEFAULT_LNG], 17);

L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
    maxZoom: 21,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "&copy; Google Satellite"
}).addTo(map);

const marker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { draggable: true }).addTo(map);

function setAlamatValue(teks) {
    if (!teks) return;
    isProgrammaticEdit = true;
    alamatTextarea.value = teks;
    setTimeout(() => {
        isProgrammaticEdit = false;
    }, 200);
}

function punyaPlusCode(teks) {
    return /\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/i.test(teks);
}

async function sinkronDariKoordinat(lat, lng, timpaAlamat = true) {
    const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    koordinatInput.value = coords;
    linkBukaGmaps.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    koordinatText.innerHTML = `<i class="ri-loader-4-line"></i> Mengambil alamat titik ${coords}...`;

    try {
        let alamatTerbentuk = "";

        const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
        const nomRes = await fetch(nomUrl);
        if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (nomData && nomData.display_name) {
                alamatTerbentuk = nomData.display_name;
            }
        }

        if (!alamatTerbentuk) {
            const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`;
            const res = await fetch(url);
            const data = await res.json();

            const bagian = [
                data.locality,
                data.city,
                data.principalSubdivision,
                data.countryName
            ].filter(Boolean);
            alamatTerbentuk = [...new Set(bagian)].join(", ");
        }

        if (alamatTerbentuk && (timpaAlamat || !alamatTextarea.value.trim())) {
            setAlamatValue(alamatTerbentuk);
        }

        koordinatText.innerHTML = `<i class="ri-map-pin-2-fill" style="color:#10b981;"></i> Titik terkunci: ${coords}`;
    } catch (err) {
        console.error("Gagal reverse geocode:", err);
        koordinatText.innerHTML = `<i class="ri-map-pin-2-fill" style="color:#10b981;"></i> Koordinat: ${coords}`;
    }
}

function buatVariasiPencarian(teks) {
    const bersih = teks
        .replace(/\b(Kec\.?|Kab\.?|Kota|Jl\.?|Gg\.?|Kp\.?|RT\.?|RW\.?|No\.?)\b/gi, " ")
        .replace(/\b\d{5}\b/g, " ")
        .replace(/,\s*Indonesia$/i, "")
        .replace(/\s+/g, " ")
        .trim();

    const bagian = bersih.split(",").map(s => s.trim()).filter(Boolean);
    const variasi = [];

    if (bersih) variasi.push(bersih);
    if (bagian.length >= 3) {
        variasi.push(bagian.slice(-3).join(", "));
        variasi.push(bagian.slice(-2).join(", "));
    } else if (bagian.length === 2) {
        variasi.push(bagian.join(", "));
    }

    return [...new Set(variasi)];
}

async function arahkanPetaDariAlamat(teksAlamat) {
    const queryAsli = teksAlamat.trim();
    if (queryAsli.length < 4) return;

    if (punyaPlusCode(queryAsli)) {
        koordinatText.innerHTML = `<i class="ri-information-line"></i> Plus Code terdeteksi — geser pin ke atap rumah atau klik Buka Maps`;
        return;
    }

    const seq = ++searchSeq;
    koordinatText.innerHTML = `<i class="ri-loader-4-line"></i> Mencari lokasi di peta...`;

    const kandidat = buatVariasiPencarian(queryAsli);

    try {
        for (const q of kandidat) {
            if (seq !== searchSeq) return;

            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=id&limit=1`;
            const res = await fetch(url);
            const data = await res.json();

            if (seq !== searchSeq) return;

            if (Array.isArray(data) && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

                map.flyTo([lat, lng], 18);
                marker.setLatLng([lat, lng]);
                koordinatInput.value = coords;
                linkBukaGmaps.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

                if (data[0].display_name) {
                    setAlamatValue(data[0].display_name);
                }

                koordinatText.innerHTML = `<i class="ri-map-pin-2-fill" style="color:#10b981;"></i> Lokasi ditemukan (${coords}) — geser pin jika perlu`;
                return;
            }
        }

        koordinatText.innerHTML = `<i class="ri-information-line"></i> Titik belum ketemu, ketuk/geser pin langsung di peta`;
    } catch (err) {
        console.error("Gagal mencari area:", err);
        koordinatText.innerHTML = `<i class="ri-drag-move-2-line"></i> Klik atau geser pin ke atap rumah`;
    }
}

alamatTextarea.addEventListener("input", function () {
    if (isProgrammaticEdit) return;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        arahkanPetaDariAlamat(this.value);
    }, 900);
});

marker.on("dragend", () => {
    const pos = marker.getLatLng();
    sinkronDariKoordinat(pos.lat, pos.lng, true);
});

map.on("click", (e) => {
    marker.setLatLng(e.latlng);
    sinkronDariKoordinat(e.latlng.lat, e.latlng.lng, true);
});

btnLokasi.addEventListener("click", function () {
    btnLokasi.innerHTML = '<i class="ri-loader-4-line"></i> Mencari GPS...';

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                map.flyTo([lat, lng], 19);
                marker.setLatLng([lat, lng]);
                sinkronDariKoordinat(lat, lng, true);

                btnLokasi.innerHTML = '<i class="ri-check-line"></i> Lokasi Ditemukan';
            },
            () => {
                alert("Gagal mengambil GPS. Pastikan izin lokasi aktif di browser.");
                btnLokasi.innerHTML = '<i class="ri-crosshair-2-line"></i> Lokasi Saya (GPS)';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        alert("Browser tidak mendukung GPS.");
    }
});

// =========================================================================
// SUBMIT FORM DENGAN VALIDASI NAMA, NO HP 12 DIGIT & DETAIL ALAMAT
// =========================================================================

formEl.addEventListener("submit", function (e) {
    e.preventDefault();

    const pesanNama = validasiNamaLengkap(namaInput.value);
    if (pesanNama) {
        namaInput.setCustomValidity(pesanNama);
        namaInput.reportValidity();
        namaInput.focus();
        return;
    }
    namaInput.setCustomValidity("");

    const pesanHp = validasiNomorHpIndo(noHpInput.value);
    if (pesanHp) {
        noHpInput.setCustomValidity(pesanHp);
        noHpInput.reportValidity();
        noHpInput.focus();
        return;
    }
    noHpInput.setCustomValidity("");

    if (!alamatTextarea.value.trim()) {
        alamatTextarea.setCustomValidity("Silakan tentukan titik lokasi di peta atau isi alamat wilayah.");
        alamatTextarea.reportValidity();
        alamatTextarea.focus();
        return;
    }
    alamatTextarea.setCustomValidity("");

    if (!detailAlamatInput.value.trim()) {
        detailAlamatInput.setCustomValidity("Harap isi detail alamat (nomor rumah, RT/RW, atau patokan).");
        detailAlamatInput.reportValidity();
        detailAlamatInput.focus();
        return;
    }
    detailAlamatInput.setCustomValidity("");

    if (!paketSelect.value) {
        paketSelect.setCustomValidity("Silakan pilih paket layanan terlebih dahulu.");
        paketSelect.reportValidity();
        paketSelect.focus();
        return;
    }
    paketSelect.setCustomValidity("");

    const randomId = "REG-" + Math.floor(100000 + Math.random() * 900000);
    document.getElementById("display-reg-id").textContent = randomId;

    document.getElementById("form-section").classList.add("hidden");
    document.getElementById("success-section").classList.remove("hidden");
});