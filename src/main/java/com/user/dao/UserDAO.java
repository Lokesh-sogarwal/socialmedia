package com.user.dao;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import com.user.model.User;

public class UserDAO {

    private String jdbcURL = "jdbc:mysql://localhost:3306/socialmedia";
    private String jdbcUserName = "root";
    private String jdbcPassword = "";

    private static final String INSERT_USER_SQL = "INSERT INTO user (username, firstname, lastname, email, country, passwd) VALUES (?, ?, ?, ?, ?, ?);";
    private static final String SELECT_USER_BY_ID = "SELECT * FROM user WHERE ID = ?;";
    private static final String SELECT_ALL_USER = "SELECT * FROM user;";
    private static final String DELETE_USER_BY_ID = "DELETE FROM user WHERE ID = ?;";
    private static final String UPDATE_USER_SQL = "UPDATE user SET USERNAME = ?, EMAIL = ?, COUNTRY = ?, PASSWORD = ?, FIRSTNAME = ?, LASTNAME = ? WHERE ID = ?;";

    public UserDAO() {
        super();
    }

    public Connection getConnection() {
        Connection connection = null;
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            connection = DriverManager.getConnection(jdbcURL, jdbcUserName, jdbcPassword);
        } catch (SQLException e) {
            e.printStackTrace();
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }
        return connection;
    }

    public void insertUser(User user) {
        try (Connection connection = getConnection(); PreparedStatement preparedStatement = connection.prepareStatement(INSERT_USER_SQL)) {

            preparedStatement.setString(1, user.getUsername());
            preparedStatement.setString(2, user.getFirstname());
            preparedStatement.setString(3, user.getLastname());
            preparedStatement.setString(4, user.getEmail());
            preparedStatement.setString(5, user.getCountry());
            preparedStatement.setString(6, user.getPassword());

            preparedStatement.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public User selectUser(int id) {
        User user = null;
        try (Connection connection = getConnection(); PreparedStatement preparedStatement = connection.prepareStatement(SELECT_USER_BY_ID)) {
            preparedStatement.setInt(1, id);
            ResultSet resultSet = preparedStatement.executeQuery();
            if (resultSet.next()) {
                user = new User();
                user.setId(resultSet.getInt("ID"));
                user.setUsername(resultSet.getString("USERNAME"));
                user.setEmail(resultSet.getString("EMAIL"));
                user.setPassword(resultSet.getString("PASSWORD"));
                user.setFirstname(resultSet.getString("FIRSTNAME"));
                user.setLastname(resultSet.getString("LASTNAME"));
                user.setCountry(resultSet.getString("COUNTRY"));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return user;
    }

    public List<User> selectAllUsers() {
        List<User> users = new ArrayList<>();
        try (Connection connection = getConnection(); PreparedStatement preparedStatement = connection.prepareStatement(SELECT_ALL_USER)) {
            ResultSet resultSet = preparedStatement.executeQuery();
            while (resultSet.next()) {
                User user = new User();
                user.setId(resultSet.getInt("ID"));
                user.setUsername(resultSet.getString("USERNAME"));
                user.setEmail(resultSet.getString("EMAIL"));
                user.setPassword(resultSet.getString("PASSWORD"));
                user.setFirstname(resultSet.getString("FIRSTNAME"));
                user.setLastname(resultSet.getString("LASTNAME"));
                user.setCountry(resultSet.getString("COUNTRY"));
                users.add(user);  // Add the populated user object directly
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return users;
    }
    public boolean deleteUser(int id) {
        boolean status = false;
        try (Connection connection = getConnection(); PreparedStatement preparedStatement = connection.prepareStatement(DELETE_USER_BY_ID)) {
            preparedStatement.setInt(1, id);  // Set the ID in the prepared statement
            status = preparedStatement.executeUpdate() > 0;  // Execute the update and check if a row was deleted
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return status;
    }
      

}
