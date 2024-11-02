export function chart(data) {
    google.charts.load("current", { packages: ["corechart"] });
    google.charts.setOnLoadCallback(drawChart);

    function drawChart() {
        var data = google.visualization.arrayToDataTable(data);

        var options = {
            is3D: true,
            backgroundColor: "black",
            width: 350,
        };

        var chart = new google.visualization.PieChart(
            document.getElementById("piechart_3d"),
        );

        chart.draw(data, options);
    }
}
