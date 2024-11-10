create database socialmedia;
use socialmedia;

create table user
(
id integer auto_increment primary key,
username varchar(100) not null unique ,
firstname varchar(20) not null,
lastname varchar(20),
email varchar(50) not null unique,
country varchar(50) not null,
passwd varchar(20) not null
);