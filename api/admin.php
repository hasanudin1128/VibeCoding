<?php
require_once __DIR__ . '/../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') json_response(['ok'=>false,'message'=>'Metode tidak didukung.'],405);
$in = json_decode(file_get_contents('php://input'), true) ?? [];
$id = filter_var($in['id'] ?? null,FILTER_VALIDATE_INT); $status = $in['status'] ?? '';
if (!$id || !in_array($status,['Pending','Lunas','Batal'],true)) json_response(['ok'=>false,'message'=>'Data status tidak valid.'],422);
try { $stmt=db()->prepare('UPDATE pemesanan SET status_pembayaran=? WHERE id=?'); $stmt->execute([$status,$id]); if (!$stmt->rowCount()) { $check=db()->prepare('SELECT id FROM pemesanan WHERE id=?'); $check->execute([$id]); if (!$check->fetch()) json_response(['ok'=>false,'message'=>'Pesanan tidak ditemukan.'],404); } json_response(['ok'=>true,'message'=>'Status pesanan diperbarui.']); }
catch(Throwable $e) { json_response(['ok'=>false,'message'=>'Gagal memperbarui status.'],500); }
