CREATE DATABASE IF NOT EXISTS JatekAdatbazis CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
USE JatekAdatbazis;

CREATE TABLE Targy (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Nev VARCHAR(100) NOT NULL,
    Tipus VARCHAR(50)
);

CREATE TABLE Jatekos (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Nev VARCHAR(100) NOT NULL
    -- A 'Leltár' egy listaként van jelölve a diagramon. 
    -- Relációs adatbázisban ezt egy külön kapcsolótáblával oldjuk meg (lásd lent).
);

CREATE TABLE NPC (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Nev VARCHAR(100) NOT NULL,
    Szemelyiseg TEXT,
    Fontos_tulajdonsag VARCHAR(255)
);

CREATE TABLE Terkep (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Koordinatak VARCHAR(50),
    Leiras TEXT,
    Ralepett_e_a_jatekos BOOLEAN DEFAULT FALSE,
    Targy_ID INT,
    NPC_ID INT,
    FOREIGN KEY (Targy_ID) REFERENCES Targy(ID) ON DELETE SET NULL,
    FOREIGN KEY (NPC_ID) REFERENCES NPC(ID) ON DELETE SET NULL
);

CREATE TABLE Jatek (
    Jatekos_ID INT,
    Terkep_ID INT,
    PRIMARY KEY (Jatekos_ID, Terkep_ID),
    FOREIGN KEY (Jatekos_ID) REFERENCES Jatekos(ID) ON DELETE CASCADE,
    FOREIGN KEY (Terkep_ID) REFERENCES Terkep(ID) ON DELETE CASCADE
);

CREATE TABLE Leltar (
    Jatekos_ID INT,
    Targy_ID INT,
    Mennyiseg INT DEFAULT 1,
    FOREIGN KEY (Jatekos_ID) REFERENCES Jatekos(ID) ON DELETE CASCADE,
    FOREIGN KEY (Targy_ID) REFERENCES Targy(ID) ON DELETE CASCADE
);