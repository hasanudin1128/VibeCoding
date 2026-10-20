<?php
require_once __DIR__ . '/../config.php';
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT p.id,p.nama_pemesan,p.no_hp,p.email,p.id_lapangan,p.tanggal,p.jam_mulai,p.jam_selesai,p.total_harga,p.status_pembayaran,p.created_at,l.nama_lapangan,l.jenis FROM pemesanan p JOIN lapangan l ON l.id=p.id_lapangan ORDER BY p.created_at DESC LIMIT 30");
    json_response(['ok'=>true,'data'=>$stmt->fetchAll()]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['ok'=>false,'message'=>'Metode tidak didukung.'], 405);
$in = json_decode(file_get_contents('php://input'), true) ?? [];
$name = trim($in['nama_pemesan'] ?? ''); $phone = trim($in['no_hp'] ?? ''); $email = trim($in['email'] ?? '');
$court = filter_var($in['id_lapangan'] ?? null, FILTER_VALIDATE_INT); $date = $in['tanggal'] ?? '';
$start = $in['jam_mulai'] ?? ''; $end = $in['jam_selesai'] ?? '';
if ($name === '' || mb_strlen($name)>120 || !preg_match('/^[0-9+() .-]{8,25}$/', $phone) || !filter_var($email,FILTER_VALIDATE_EMAIL) || !$court || !preg_match('/^\d{4}-\d{2}-\d{2}$/',$date) || !preg_match('/^\d{2}:\d{2}$/',$start) || !preg_match('/^\d{2}:\d{2}$/',$end)) json_response(['ok'=>false,'message'=>'Periksa kembali data pemesan dan jadwal.'],422);
if ($date < date('Y-m-d') || $start < '07:00' || $end > '23:00' || $end <= $start) json_response(['ok'=>false,'message'=>'Tanggal atau jam tidak valid. Jam operasional 07.00–23.00.'],422);
$startAt = strtotime($date.' '.$start); $endAt = strtotime($date.' '.$end);
if (($endAt-$startAt)%3600 !== 0 || ($endAt-$startAt)<3600) json_response(['ok'=>false,'message'=>'Durasi minimal satu jam dan harus kelipatan satu jam.'],422);
$hours = (int)(($endAt-$startAt)/3600);
try {
    $pdo->beginTransaction();
    // Lock baris lapangan agar booking bersamaan pada lapangan yang sama diperiksa berurutan.
    $courtStmt = $pdo->prepare('SELECT id,harga_per_jam FROM lapangan WHERE id=? FOR UPDATE');
    $courtStmt->execute([$court]); $courtData = $courtStmt->fetch();
    if (!$courtData) { $pdo->rollBack(); json_response(['ok'=>false,'message'=>'Lapangan tidak ditemukan.'],404); }
    $conflict = $pdo->prepare("SELECT id FROM pemesanan WHERE id_lapangan=? AND tanggal=? AND status_pembayaran <> 'Batal' AND jam_mulai < ? AND jam_selesai > ? LIMIT 1");
    $conflict->execute([$court,$date,$end,$start]);
    if ($conflict->fetch()) { $pdo->rollBack(); json_response(['ok'=>false,'message'=>'Slot tersebut baru saja dipesan. Silakan pilih jam lain.'],409); }
    $total = (float)$courtData['harga_per_jam'] * $hours;
    $insert = $pdo->prepare("INSERT INTO pemesanan (nama_pemesan,no_hp,email,id_lapangan,tanggal,jam_mulai,jam_selesai,total_harga,status_pembayaran) VALUES (?,?,?,?,?,?,?,?, 'Pending')");
    $insert->execute([$name,$phone,$email,$court,$date,$start,$end,$total]); $id = (int)$pdo->lastInsertId();
    $pdo->commit();
    $stmt = $pdo->prepare("SELECT p.*,l.nama_lapangan,l.jenis FROM pemesanan p JOIN lapangan l ON l.id=p.id_lapangan WHERE p.id=?"); $stmt->execute([$id]);
    json_response(['ok'=>true,'message'=>'Booking berhasil dibuat. Silakan lanjutkan simulasi pembayaran.','data'=>$stmt->fetch()],201);
} catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); json_response(['ok'=>false,'message'=>'Terjadi kesalahan saat menyimpan booking. Periksa koneksi database.'],500); }
