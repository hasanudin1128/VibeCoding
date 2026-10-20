<?php
require_once __DIR__ . '/../config.php';
try {
    $rows = db()->query('SELECT id,nama_lapangan,jenis,harga_per_jam,foto FROM lapangan ORDER BY jenis,nama_lapangan')->fetchAll();
    json_response(['ok'=>true,'data'=>$rows]);
} catch (Throwable $e) { json_response(['ok'=>false,'message'=>'Tidak dapat memuat data lapangan.'], 500); }
