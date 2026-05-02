import java.util.Scanner;

class Room {
    int roomNumber;
    String type;
    boolean isAvailable;

    Room(int roomNumber, String type, boolean isAvailable) {
        this.roomNumber = roomNumber;
        this.type = type;
        this.isAvailable = isAvailable;
    }
}

public class HotelBookingSystem {

    static Room[] rooms = {
        new Room(101, "Single", true),
        new Room(102, "Double", true),
        new Room(103, "Suite", false)
    };

    static Scanner sc = new Scanner(System.in);

    public static void main(String[] args) {
        int choice;

        do {
            System.out.println("\n-----------------------------------");
            System.out.println("     HOTEL ROOM BOOKING SYSTEM     ");
            System.out.println("-----------------------------------");
            System.out.println("1. View Rooms");
            System.out.println("2. Book a Room");
            System.out.println("3. Cancel Booking");
            System.out.println("4. Check Availability");
            System.out.println("5. Generate Receipt");
            System.out.println("6. Exit");

            System.out.print("Choose an option: ");
            choice = sc.nextInt();

            switch (choice) {
                case 1:
                    viewRooms();
                    break;
                case 2:
                    bookRoom();
                    break;
                case 3:
                    cancelBooking();
                    break;
                case 4:
                    checkAvailability();
                    break;
                case 5:
                    System.out.println("Receipt already shown after booking.");
                    break;
                case 6:
                    System.out.println("Exiting system...");
                    break;
                default:
                    System.out.println("Invalid choice!");
            }

        } while (choice != 6);
    }

    static void viewRooms() {
        System.out.println("\nRoom Number\tType\t\tAvailability");
        for (Room r : rooms) {
            System.out.println(r.roomNumber + "\t\t" + r.type + "\t\t" +
                    (r.isAvailable ? "Available" : "Unavailable"));
        }
    }

    static void checkAvailability() {
        viewRooms();
    }

    static void bookRoom() {
        sc.nextLine(); // clear buffer

        System.out.print("Enter check-in date (YYYY-MM-DD): ");
        String checkIn = sc.nextLine();

        System.out.print("Enter check-out date (YYYY-MM-DD): ");
        String checkOut = sc.nextLine();

        System.out.println("\nAvailable rooms:");
        for (Room r : rooms) {
            if (r.isAvailable) {
                System.out.println(r.roomNumber + " - " + r.type);
            }
        }

        System.out.print("Select room number: ");
        int roomNum = sc.nextInt();

        for (Room r : rooms) {
            if (r.roomNumber == roomNum && r.isAvailable) {
                r.isAvailable = false;

                System.out.println("Room " + roomNum + " booked successfully!");

                generateReceipt(r, checkIn, checkOut);
                return;
            }
        }

        System.out.println("Room not available!");
    }

    static void cancelBooking() {
        System.out.print("Enter room number to cancel: ");
        int roomNum = sc.nextInt();

        for (Room r : rooms) {
            if (r.roomNumber == roomNum) {
                r.isAvailable = true;
                System.out.println("Booking cancelled for room " + roomNum);
                return;
            }
        }

        System.out.println("Invalid room number!");
    }

    static void generateReceipt(Room room, String checkIn, String checkOut) {
        System.out.println("\n----------- Receipt -----------");
        System.out.println("Room Number: " + room.roomNumber);
        System.out.println("Room Type: " + room.type);
        System.out.println("Check-in Date: " + checkIn);
        System.out.println("Check-out Date: " + checkOut);
        System.out.println("Total Cost: $200.00"); // fixed price
        System.out.println("-------------------------------");
    }
}