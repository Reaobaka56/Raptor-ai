#include <iostream>
using namespace std;

enum Fruit
{
    Apple,
    Banana = 5,
    Orange
};

int main()
{
    Fruit myFruit = Banana;   // Initial value

    // Change the value
    myFruit = Orange;

    switch (myFruit)
    {
        case Apple:
            cout << "Apple";
            break;

        case Banana:
            cout << "Banana";
            break;

        case Orange:
            cout << "Orange";
            break;

        default:
            cout << "Invalid fruit";
    }

    return 0;
}
