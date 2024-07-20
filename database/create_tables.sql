CREATE DATABASE blockchain;
USE blockchain;

CREATE TABLE blocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hash VARCHAR(255) NOT NULL UNIQUE,
    previous_hash VARCHAR(255),
    timestamp BIGINT,
    nonce INT,
    difficulty INT
);

CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hash VARCHAR(255) NOT NULL UNIQUE,
    block_hash VARCHAR(255) NOT NULL,
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    amount DECIMAL(18, 8),
    timestamp BIGINT,
    signature TEXT,
    FOREIGN KEY (block_hash) REFERENCES blocks(hash)
);

