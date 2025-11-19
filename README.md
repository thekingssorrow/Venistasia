Venistasia – A Browser-Based Text Adventure RPG

Venistasia is a modernized, browser-based text adventure game inspired by classic 80s titles like ZORK. The entire game is played through typed commands, with the goal of recreating the feel of old-school interactive fiction while using a full modern web stack.

This project was created for the CSCI 331 Web Development course at Montana State University.

About the Game

Venistasia is a text-driven RPG where the player can explore locations, view descriptions, manage inventory, gain experience, level up, and interact with the world through simple commands such as:

look
go <direction>
inventory
name <your name>
…and more coming soon.

Despite its retro style, the game features a real backend with persistent save data and a growing world.

Technology Stack

This project uses a simple but complete web stack:

Frontend
HTML5 – Page structure
CSS3 – Retro-inspired UI styling
JavaScript – Game engine, command parser, UI updates, autosaving logic

Backend
PHP – API endpoints (save.php, load.php)
MariaDB – Stores player save data in JSON format

Hosting
Fully hosted on the CSCI331VM Linux Apache server
Game directory: ~/public_html/venistasia/

Features Implemented

Text-based command parser
Multiple locations with descriptions
Player stats (HP, XP, Leveling)
Inventory system
Autosave every few seconds
Automatic load on startup
Unique player IDs stored in localStorage
PHP backend for saving/loading JSON state
MariaDB table for persistent storage

Database Structure
The game uses a single table:

CREATE TABLE venistasia_saves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(64) NOT NULL UNIQUE,
  state_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
Each row stores a full JSON snapshot of the player’s game state.

How to Run the Project
1. Clone the repository

git clone https://github.com/<your-username>/<your-repo>.git

2. Upload to your server
Place all project files inside:

~/public_html/venistasia/

3. Configure backend
Update api/save.php and api/load.php with your database credentials:

$db_host = "localhost";
$db_user = "userXX";
$db_pass = "yourpassword";
$db_name = "dbXX";

4. Create the database table

mysql -u userXX -p dbXX < db.sql


Commands to Try

Type these into the command box:

look
go north
inventory
name Six
help

Planned Features
Future additions include:
Combat system (monsters, attacks, loot)
Expanded world map
NPC interactions
Quest system
More items and stats

Project Structure

venistasia/
│
├── index.html
├── style.css
│
├── js/
│   └── game.js
│
├── api/
│   ├── save.php
│   └── load.php
│
└── db.sql

Contributors
Solo Developer: Nathan Hager

License

This project is for educational purposes only as part of CSCI 331.
Feel free to adapt or extend it, but please credit the creator.
