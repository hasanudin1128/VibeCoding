<?php
require_once __DIR__ . '/../config.php';
$court = filter_input(INPUT_GET, 'court', FILTER_VALIDATE_INT);
$date = $_GET['date'] ?? '';
if (!$court || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) json_response(['ok'=>false,'message'=>'Lapangan atau tanggal tidak valid.'], 422);
try {
    $stmt = db()->prepare("SELECT jam_mulai,jam_selesai FROM pemesanan WHERE id_lapangan=? AND tanggal=? AND status_pembayaran <> 'Batal'");
    $stmt->execute([$court,$date]);
    json_response(['ok'=>true,'data'=>$stmt->fetchAll()]);
} catch (Throwable $e) { json_response(['ok'=>false,'message'=>'Gagal memuat slot.'], 500); }
