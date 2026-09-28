import QRCode from "qrcode";

/**
 * Credencial en imagen (1080 × 1350, el formato vertical que WhatsApp muestra
 * completo) con el QR del participante. Se dibuja en el navegador: no pasa por
 * el servidor y sale lista para descargar o compartir.
 */

interface Datos {
  contenido: string;
  nombre: string;
  barrio: string;
  estaca: string;
  marca: { nombre: string; sesion: string };
}

const ANCHO = 1080;
const ALTO = 1350;

function cargar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = src;
  });
}

function ajustar(ctx: CanvasRenderingContext2D, texto: string, maximo: number, tamano: number, peso: number, familia: string) {
  let t = tamano;
  do {
    ctx.font = `${peso} ${t}px ${familia}`;
    if (ctx.measureText(texto).width <= maximo) break;
    t -= 2;
  } while (t > 28);
}

export async function crearCredencialPng(d: Datos): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede generar la imagen.");
  // La fuente de la página (next/font le cambia el nombre): la misma que se ve en pantalla.
  const familia = getComputedStyle(document.body).fontFamily || "sans-serif";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Franja superior con el sol, como en el login
  const franja = ctx.createLinearGradient(0, 0, ANCHO, 330);
  franja.addColorStop(0, "#025582");
  franja.addColorStop(1, "#012a42");
  ctx.fillStyle = franja;
  ctx.fillRect(0, 0, ANCHO, 330);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ANCHO, 330);
  ctx.clip();
  ctx.fillStyle = "#feb347";
  ctx.beginPath();
  ctx.arc(ANCHO - 70, 10, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  try {
    const logo = await cargar("/brand/logo.png");
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(70, 90, 150, 150, 36);
    ctx.clip();
    ctx.drawImage(logo, 70, 90, 150, 150);
    ctx.restore();
  } catch {
    // Sin logo la credencial sigue sirviendo.
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 80px ${familia}`;
  ctx.fillText(d.marca.nombre, 255, 175);
  ctx.fillStyle = "#93dae6";
  ctx.font = `600 40px ${familia}`;
  ctx.fillText(d.marca.sesion, 258, 232);

  ctx.textAlign = "center";
  ctx.fillStyle = "#012a42";
  ajustar(ctx, d.nombre, ANCHO - 120, 60, 800, familia);
  ctx.fillText(d.nombre, ANCHO / 2, 430);
  ctx.fillStyle = "#52697a";
  ajustar(ctx, [d.barrio, d.estaca].filter(Boolean).join(" · "), ANCHO - 120, 36, 500, familia);
  ctx.fillText([d.barrio, d.estaca].filter(Boolean).join(" · "), ANCHO / 2, 490);

  const qr = await cargar(
    await QRCode.toDataURL(d.contenido, { width: 640, margin: 1, errorCorrectionLevel: "M", color: { dark: "#012a42", light: "#ffffff" } }),
  );
  ctx.drawImage(qr, (ANCHO - 640) / 2, 540, 640, 640);

  ctx.fillStyle = "#52697a";
  ctx.font = `500 34px ${familia}`;
  ctx.fillText("Presenta este código al llegar a la conferencia", ANCHO / 2, 1262);

  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo crear la imagen."))), "image/png"));
}
