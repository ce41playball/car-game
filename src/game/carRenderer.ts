import {
  ActiveCar,
  CAR_HEIGHT,
  CarPalette,
  FloatingText,
  LOGICAL_WIDTH,
  Particle,
  SlicedDebris,
  StackedCar,
} from '../types/game';

interface RGB {
  r: number;
  g: number;
  b: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRGB(c1: RGB, c2: RGB, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(lerp(c1.r, c2.r, clamped));
  const g = Math.round(lerp(c1.g, c2.g, clamped));
  const b = Math.round(lerp(c1.b, c2.b, clamped));
  return `rgb(${r}, ${g}, ${b})`;
}

const SKY_STAGES: { alt: number; top: RGB; mid: RGB; bot: RGB }[] = [
  // Sunny Daytime
  {
    alt: 0,
    top: { r: 56, g: 189, b: 248 },
    mid: { r: 125, g: 211, b: 252 },
    bot: { r: 224, g: 242, b: 254 },
  },
  // Warm Golden Hour
  {
    alt: 650,
    top: { r: 96, g: 165, b: 250 },
    mid: { r: 251, g: 191, b: 36 },
    bot: { r: 254, g: 243, b: 199 },
  },
  // Sunset / Dusk
  {
    alt: 1400,
    top: { r: 49, g: 46, b: 129 },
    mid: { r: 192, g: 132, b: 252 },
    bot: { r: 253, g: 164, b: 175 },
  },
  // Stratosphere Night
  {
    alt: 2200,
    top: { r: 15, g: 23, b: 42 },
    mid: { r: 30, g: 41, b: 59 },
    bot: { r: 49, g: 46, b: 129 },
  },
];

function getSkyColors(cameraY: number): { top: string; mid: string; bot: string; nightFactor: number } {
  let i = 0;
  while (i < SKY_STAGES.length - 2 && cameraY > SKY_STAGES[i + 1].alt) {
    i++;
  }
  const s1 = SKY_STAGES[i];
  const s2 = SKY_STAGES[i + 1];
  const span = Math.max(1, s2.alt - s1.alt);
  const t = Math.max(0, Math.min(1, (cameraY - s1.alt) / span));

  const nightFactor = Math.max(0, Math.min(1, (cameraY - 1100) / 1100));
  return {
    top: lerpRGB(s1.top, s2.top, t),
    mid: lerpRGB(s1.mid, s2.mid, t),
    bot: lerpRGB(s1.bot, s2.bot, t),
    nightFactor,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawSkyAndCity(
  ctx: CanvasRenderingContext2D,
  logicalH: number,
  groundScreenY: number,
  cameraY: number,
  timeSec: number
): void {
  const { top, mid, bot, nightFactor } = getSkyColors(cameraY);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, logicalH);
  skyGrad.addColorStop(0, top);
  skyGrad.addColorStop(0.55, mid);
  skyGrad.addColorStop(1, bot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, logicalH);

  // Twinkling stars at high altitude
  if (nightFactor > 0.05) {
    ctx.save();
    for (let s = 0; s < 28; s++) {
      const sx = ((s * 97 + 31) % (LOGICAL_WIDTH - 20)) + 10;
      const sy = ((s * 53 + 19) % Math.max(120, logicalH * 0.65)) + 24;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(timeSec * 1.8 + s * 1.3));
      ctx.fillStyle = `rgba(255, 255, 255, ${(nightFactor * twinkle * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s % 3 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Sun (shifts softly down as altitude rises)
  const sunAlpha = Math.max(0, 1 - nightFactor * 1.25);
  if (sunAlpha > 0.02) {
    const sunY = 128 + cameraY * 0.08;
    ctx.save();
    ctx.globalAlpha = sunAlpha;
    ctx.fillStyle = 'rgba(254, 240, 138, 0.32)';
    ctx.beginPath();
    ctx.arc(335, sunY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(335, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Drifting parallax clouds
  const cloudParallaxY = cameraY * 0.25;
  const clouds = [
    { baseX: 50, baseY: 140, scale: 0.9, speed: 9 },
    { baseX: 240, baseY: 210, scale: 1.1, speed: 6 },
    { baseX: 130, baseY: 320, scale: 0.78, speed: 12 },
    { baseX: 340, baseY: 95, scale: 0.72, speed: 7.5 },
  ];

  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${(0.82 - nightFactor * 0.55).toFixed(2)})`;
  for (const c of clouds) {
    const cx = ((c.baseX + timeSec * c.speed) % (LOGICAL_WIDTH + 140)) - 70;
    const cy = ((c.baseY + cloudParallaxY) % (logicalH + 120)) - 40;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(c.scale, c.scale);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.arc(18, -5, 22, 0, Math.PI * 2);
    ctx.arc(38, 0, 17, 0, Math.PI * 2);
    ctx.arc(19, 6, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Distant Urban Skyline (scrolls down slowly at 0.35x parallax)
  const cityBaseY = groundScreenY + cameraY * 0.35;
  if (cityBaseY < logicalH + 260) {
    const buildings = [
      { x: -6, w: 54, h: 128, color: '#94A3B8' },
      { x: 44, w: 46, h: 175, color: '#CBD5E1' },
      { x: 86, w: 62, h: 112, color: '#94A3B8' },
      { x: 142, w: 50, h: 196, color: '#CBD5E1' },
      { x: 188, w: 56, h: 145, color: '#94A3B8' },
      { x: 240, w: 48, h: 168, color: '#CBD5E1' },
      { x: 284, w: 64, h: 124, color: '#94A3B8' },
      { x: 344, w: 52, h: 186, color: '#CBD5E1' },
      { x: 390, w: 42, h: 138, color: '#94A3B8' },
    ];

    ctx.save();
    ctx.globalAlpha = 0.65;
    for (const b of buildings) {
      const topY = cityBaseY - b.h;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, topY, b.w, b.h + 40);

      // Subtle window grid
      ctx.fillStyle = nightFactor > 0.35 ? 'rgba(253, 224, 71, 0.55)' : 'rgba(255, 255, 255, 0.5)';
      const cols = Math.floor((b.w - 12) / 11);
      const rows = Math.floor((b.h - 18) / 16);
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          if ((r + col) % 3 === 0) continue;
          ctx.fillRect(b.x + 7 + col * 11, topY + 10 + r * 16, 6, 9);
        }
      }
    }
    ctx.restore();
  }
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  logicalH: number,
  groundScreenY: number,
  cameraY: number
): void {
  const screenY = groundScreenY + cameraY;
  if (screenY > logicalH + 40) return;

  // Cute urban sidewalk trees / streetlamps behind curb
  const propPositions = [28, 392];
  for (const px of propPositions) {
    // Tree trunk
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.fillRect(px - 4, screenY - 34, 8, 34);
    ctx.strokeRect(px - 4, screenY - 34, 8, 34);

    // Leafy canopy
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(px, screenY - 44, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.arc(px - 4, screenY - 48, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sidewalk curb
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(0, screenY, LOGICAL_WIDTH, 14);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(0, screenY + 10, LOGICAL_WIDTH, 4);

  // Curb outline
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, screenY);
  ctx.lineTo(LOGICAL_WIDTH, screenY);
  ctx.stroke();

  // Asphalt Street
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, screenY + 14, LOGICAL_WIDTH, logicalH - screenY + 60);

  // Painted parking / drop zone markers on road
  ctx.fillStyle = '#FACC15';
  for (let x = 22; x < LOGICAL_WIDTH - 20; x += 42) {
    ctx.fillRect(x, screenY + 34, 22, 5);
  }

  // White parking bay stop marks
  ctx.fillStyle = 'rgba(248, 250, 252, 0.45)';
  ctx.fillRect(108, screenY + 2, 6, 8);
  ctx.fillRect(LOGICAL_WIDTH - 114, screenY + 2, 6, 8);
}

export function drawCrane(
  ctx: CanvasRenderingContext2D,
  trolleyX: number,
  craneRailY: number,
  carTopScreenY: number,
  isSwinging: boolean
): void {
  // Overhead steel gantry rail
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, craneRailY - 12, LOGICAL_WIDTH, 12);

  // Truss pattern on rail
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < LOGICAL_WIDTH; x += 24) {
    ctx.moveTo(x, craneRailY - 12);
    ctx.lineTo(x + 12, craneRailY);
    ctx.lineTo(x + 24, craneRailY - 12);
  }
  ctx.stroke();

  // Rail bottom border
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, craneRailY);
  ctx.lineTo(LOGICAL_WIDTH, craneRailY);
  ctx.stroke();

  // Cable connecting trolley to grapple hook
  const cableEndY = isSwinging ? carTopScreenY - 4 : craneRailY + 26;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(trolleyX, craneRailY + 10);
  ctx.lineTo(trolleyX, cableEndY);
  ctx.stroke();

  // Trolley housing (yellow-black hazard box)
  const tw = 52;
  const th = 22;
  const tx = trolleyX - tw / 2;
  const ty = craneRailY - 6;

  ctx.save();
  drawRoundedRect(ctx, tx, ty, tw, th, 6);
  ctx.fillStyle = '#FACC15';
  ctx.fill();
  ctx.clip();

  // Diagonal hazard stripes
  ctx.fillStyle = '#1E293B';
  for (let sx = -10; sx < tw + 16; sx += 14) {
    ctx.beginPath();
    ctx.moveTo(tx + sx, ty);
    ctx.lineTo(tx + sx + 6, ty);
    ctx.lineTo(tx + sx - 4, ty + th);
    ctx.lineTo(tx + sx - 10, ty + th);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawRoundedRect(ctx, tx, ty, tw, th, 6);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Trolley rollers
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(tx + 12, craneRailY - 1, 4, 0, Math.PI * 2);
  ctx.arc(tx + tw - 12, craneRailY - 1, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Magnetic grapple clamp at cable end
  ctx.fillStyle = '#EA580C';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, trolleyX - 14, cableEndY - 6, 28, 10, 4);
  ctx.fill();
  ctx.stroke();

  // Clamp prongs
  const prongSpread = isSwinging ? 12 : 16;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(trolleyX - 8, cableEndY + 4);
  ctx.lineTo(trolleyX - prongSpread, cableEndY + 11);
  ctx.moveTo(trolleyX + 8, cableEndY + 4);
  ctx.lineTo(trolleyX + prongSpread, cableEndY + 11);
  ctx.stroke();
}

function drawFullCarArtwork(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  fw: number,
  fh: number,
  palette: CarPalette
): void {
  const wheelRadius = Math.max(6.5, Math.min(9.5, fw * 0.055));
  const chassisBottom = oy + fh - wheelRadius * 0.55;
  const chassisTop = oy + fh * 0.42;
  const chassisHeight = chassisBottom - chassisTop;

  // Roof geometry varies by car type
  let cabinLeft = ox + fw * 0.2;
  let cabinRight = ox + fw * 0.78;
  let roofTop = oy + 5;

  if (palette.type === 'van') {
    cabinLeft = ox + fw * 0.08;
    cabinRight = ox + fw * 0.9;
    roofTop = oy + 4;
  } else if (palette.type === 'suv') {
    cabinLeft = ox + fw * 0.14;
    cabinRight = ox + fw * 0.84;
    roofTop = oy + 4;
  } else if (palette.type === 'pickup') {
    cabinLeft = ox + fw * 0.15;
    cabinRight = ox + fw * 0.56;
    roofTop = oy + 5;
  } else if (palette.type === 'coupe') {
    cabinLeft = ox + fw * 0.24;
    cabinRight = ox + fw * 0.74;
    roofTop = oy + 7;
  }

  // Roof accessories (behind cabin outline)
  if (palette.type === 'taxi') {
    const signW = Math.min(26, fw * 0.18);
    drawRoundedRect(ctx, ox + fw * 0.5 - signW / 2, roofTop - 6, signW, 7, 2);
    ctx.fillStyle = '#FEF08A';
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (palette.type === 'coupe') {
    // Rear wing spoiler
    ctx.fillStyle = palette.bodyShade;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox + 6, chassisTop + 2);
    ctx.lineTo(ox + 2, chassisTop - 7);
    ctx.lineTo(ox + 16, chassisTop - 7);
    ctx.lineTo(ox + 14, chassisTop + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Cabin silhouette
  ctx.beginPath();
  ctx.moveTo(cabinLeft - fw * 0.08, chassisTop + 2);
  ctx.lineTo(cabinLeft, roofTop);
  ctx.lineTo(cabinRight, roofTop);
  ctx.lineTo(cabinRight + fw * 0.09, chassisTop + 2);
  ctx.closePath();
  ctx.fillStyle = palette.body;
  ctx.fill();
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Windows
  const winMargin = 4;
  const winLeft = cabinLeft + 4;
  const winRight = cabinRight - 4;
  const winW = Math.max(8, winRight - winLeft);
  const winTop = roofTop + winMargin;
  const winH = Math.max(6, chassisTop - winTop - 2);

  if (winW > 10) {
    drawRoundedRect(ctx, winLeft, winTop, winW, winH, 3);
    ctx.fillStyle = palette.window;
    ctx.fill();

    // Window reflection streak
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(winLeft + winW * 0.15, winTop);
    ctx.lineTo(winLeft + winW * 0.32, winTop);
    ctx.lineTo(winLeft + winW * 0.18, winTop + winH);
    ctx.lineTo(winLeft + winW * 0.04, winTop + winH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, winLeft, winTop, winW, winH, 3);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Center window pillar
    if (palette.type !== 'pickup' && winW > 26) {
      const pillarX = winLeft + winW * 0.52;
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(pillarX, winTop);
      ctx.lineTo(pillarX, winTop + winH);
      ctx.stroke();
    }
  }

  // Main Lower Chassis
  drawRoundedRect(ctx, ox + 1.5, chassisTop, fw - 3, chassisHeight, 8);
  ctx.fillStyle = palette.body;
  ctx.fill();

  // Lower body shade band
  ctx.save();
  ctx.clip();
  ctx.fillStyle = palette.bodyShade;
  ctx.fillRect(ox, chassisBottom - 7, fw, 8);

  // Taxi checkered accent strip
  if (palette.type === 'taxi') {
    ctx.fillStyle = '#1E293B';
    const stripY = chassisTop + chassisHeight * 0.45;
    for (let cx = ox + 16; cx < ox + fw - 18; cx += 12) {
      ctx.fillRect(cx, stripY, 6, 4);
      ctx.fillRect(cx + 6, stripY + 4, 6, 4);
    }
  }
  ctx.restore();

  drawRoundedRect(ctx, ox + 1.5, chassisTop, fw - 3, chassisHeight, 8);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Headlight (right) & Taillight (left)
  ctx.fillStyle = '#FEF08A';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.6;
  drawRoundedRect(ctx, ox + fw - 9, chassisTop + 5, 7, 7, 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FB7185';
  drawRoundedRect(ctx, ox + 2, chassisTop + 5, 6, 7, 2);
  ctx.fill();
  ctx.stroke();

  // Door handle
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(ox + fw * 0.46, chassisTop + 7, 8, 3);

  // Wheels
  const wheelPositions = [ox + fw * 0.23, ox + fw * 0.77];
  const wheelY = oy + fh - wheelRadius - 1;
  for (const wx of wheelPositions) {
    // Tire
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelRadius * 0.52, 0, Math.PI * 2);
    ctx.fill();

    // Center hubcap dot
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelRadius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawStackedCar(
  ctx: CanvasRenderingContext2D,
  car: StackedCar,
  groundScreenY: number,
  cameraY: number
): void {
  const screenTopY = groundScreenY - (car.y + car.height - cameraY);
  if (screenTopY > ctx.canvas.height + 80 || screenTopY + car.height < -80) return;

  // Subtle landing squash & stretch
  const squash = car.squashProgress > 0 ? Math.sin(car.squashProgress * Math.PI) * 0.14 : 0;
  const scaleY = 1 - squash;
  const scaleX = 1 + squash * 0.35;
  const pivotX = car.x + car.width / 2;
  const pivotY = screenTopY + car.height;

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-pivotX, -pivotY);

  // Clip strictly to the surviving stacked width
  ctx.save();
  ctx.beginPath();
  ctx.rect(car.x - 1, screenTopY - 12, car.width + 2, car.height + 16);
  ctx.clip();

  drawFullCarArtwork(ctx, car.spriteOriginX, screenTopY, car.spriteFullWidth, car.height, car.palette);
  ctx.restore();

  // Draw crisp cut-edge borders if car was sliced on left or right
  const slicedLeft = car.x > car.spriteOriginX + 1.5;
  const slicedRight = car.x + car.width < car.spriteOriginX + car.spriteFullWidth - 1.5;
  if (slicedLeft) {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(car.x, screenTopY + 5);
    ctx.lineTo(car.x, screenTopY + car.height - 4);
    ctx.stroke();
  }
  if (slicedRight) {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(car.x + car.width, screenTopY + 5);
    ctx.lineTo(car.x + car.width, screenTopY + car.height - 4);
    ctx.stroke();
  }

  // Golden perfect landing shimmer
  if (car.perfectGlow > 0.02) {
    ctx.fillStyle = `rgba(253, 224, 71, ${(car.perfectGlow * 0.48).toFixed(3)})`;
    drawRoundedRect(ctx, car.x, screenTopY + 4, car.width, car.height - 6, 8);
    ctx.fill();
  }

  ctx.restore();
}

export function drawActiveCar(
  ctx: CanvasRenderingContext2D,
  car: ActiveCar,
  groundScreenY: number,
  cameraY: number
): void {
  const screenTopY = groundScreenY - (car.y + car.height - cameraY);
  const cx = car.x + car.width / 2;
  const cy = screenTopY + 4;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(car.tilt);
  ctx.translate(-cx, -cy);

  drawFullCarArtwork(ctx, car.x, screenTopY, car.width, car.height, car.palette);
  ctx.restore();
}

export function drawDebris(
  ctx: CanvasRenderingContext2D,
  debris: SlicedDebris,
  groundScreenY: number,
  cameraY: number
): void {
  const screenTopY = groundScreenY - (debris.y + debris.height - cameraY);
  const cx = debris.x + debris.width / 2;
  const cy = screenTopY + debris.height / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, debris.alpha);
  ctx.translate(cx, cy);
  ctx.rotate(debris.angle);
  ctx.translate(-cx, -cy);

  ctx.beginPath();
  ctx.rect(debris.x - 1, screenTopY - 10, debris.width + 2, debris.height + 14);
  ctx.clip();

  drawFullCarArtwork(
    ctx,
    debris.spriteOriginX,
    screenTopY,
    debris.spriteFullWidth,
    CAR_HEIGHT,
    debris.palette
  );

  // Clean shear face line
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(debris.x, screenTopY + 6, debris.width, debris.height - 10);

  ctx.restore();
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  groundScreenY: number,
  cameraY: number
): void {
  for (const p of particles) {
    const sx = p.x;
    const sy = groundScreenY - (p.y - cameraY);
    const t = p.life / p.maxLife;
    const alpha = Math.max(0, 1 - t) * p.alpha;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, 4 * (1 - t));
      ctx.beginPath();
      ctx.ellipse(sx, sy, p.size * (0.6 + t * 1.4), 10 * (0.6 + t * 0.7), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * (1 - t * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[],
  groundScreenY: number,
  cameraY: number
): void {
  for (const ft of texts) {
    const t = ft.life / ft.maxLife;
    const sx = ft.x;
    const sy = groundScreenY - (ft.y - cameraY) - t * 34;
    const alpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = '800 19px "Outfit", "Noto Sans TC", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1E293B';
    ctx.strokeText(ft.text, sx, sy);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, sx, sy);

    if (ft.subtext) {
      ctx.font = '700 13px "Outfit", "Noto Sans TC", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.subtext, sx, sy + 18);
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(ft.subtext, sx, sy + 18);
    }
    ctx.restore();
  }
}
